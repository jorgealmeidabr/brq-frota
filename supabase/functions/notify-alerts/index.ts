// Edge Function: notify-alerts
// Roda diariamente (via pg_cron). Coleta alertas críticos e envia e-mail
// para todos os admins via Gmail SMTP (Nodemailer). Evita reenvio do mesmo
// alert_key no mesmo dia através da tabela `notifications_sent`.
//
// Variáveis de ambiente necessárias (já configuradas como secrets):
//   GMAIL_USER, GMAIL_APP_PASSWORD,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injetadas pelo Supabase)
//
// CORS habilitado para permitir testes manuais via fetch.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAY = 24 * 60 * 60 * 1000;
const fmtDateBR = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

interface Alert {
  key: string;
  categoria: string;
  titulo: string;
  descricao: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gmailUser = Deno.env.get("GMAIL_USER")!;
    const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD")!;

    if (!gmailUser || !gmailPass) {
      return new Response(
        JSON.stringify({ error: "GMAIL_USER/GMAIL_APP_PASSWORD ausentes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---------- coleta dados ----------
    const [veiculos, motoristas, manutencoes, multas] = await Promise.all([
      supabase.from("veiculos").select("*"),
      supabase.from("motoristas").select("*").eq("status", "ativo"),
      supabase.from("manutencoes").select("*").neq("status", "concluida"),
      supabase.from("multas").select("*").eq("status_pagamento", "pendente"),
    ]);

    const now = Date.now();
    const alerts: Alert[] = [];

    // CNH
    (motoristas.data ?? []).forEach((m: any) => {
      if (!m.cnh_validade) return;
      const dias = Math.ceil(
        (new Date(m.cnh_validade).getTime() - now) / DAY,
      );
      if (dias < 0) {
        alerts.push({
          key: `cnh:${m.id}:${m.cnh_validade}`,
          categoria: "CNH",
          titulo: `CNH vencida — ${m.nome}`,
          descricao: `Vencida em ${fmtDateBR(m.cnh_validade)} (há ${Math.abs(dias)} dias)`,
        });
      } else if (dias <= 30) {
        alerts.push({
          key: `cnh:${m.id}:${m.cnh_validade}`,
          categoria: "CNH",
          titulo: `CNH vence em ${dias} dia(s) — ${m.nome}`,
          descricao: `Vencimento: ${fmtDateBR(m.cnh_validade)}`,
        });
      }
    });

    const veicMap = new Map<string, any>(
      (veiculos.data ?? []).map((v: any) => [v.id, v]),
    );

    // Manutenções atrasadas
    (manutencoes.data ?? []).forEach((mn: any) => {
      const v = veicMap.get(mn.veiculo_id);
      const proxKm = mn.km_proxima_manutencao ?? mn.proxima_km;
      const proxData = mn.data_proxima_manutencao ?? mn.proxima_data;
      const kmDelta = proxKm && v ? v.km_atual - proxKm : null;
      const diaDelta = proxData
        ? Math.ceil((now - new Date(proxData).getTime()) / DAY)
        : null;
      const atrasada = (kmDelta != null && kmDelta > 0) ||
        (diaDelta != null && diaDelta > 0);
      if (!atrasada) return;
      alerts.push({
        key: `manut:${mn.id}`,
        categoria: "Manutenção",
        titulo: `Manutenção atrasada — ${v?.placa ?? "—"}`,
        descricao: kmDelta != null && kmDelta > 0
          ? `+${kmDelta} km da revisão prevista`
          : `${diaDelta} dia(s) após a data prevista`,
      });
    });

    // IPVA, Seguro, CRLV
    (veiculos.data ?? []).forEach((v: any) => {
      if (v.ipva_status === "pendente") {
        alerts.push({
          key: `ipva:${v.id}:${v.ipva_vencimento ?? "x"}`,
          categoria: "Documento",
          titulo: `IPVA pendente — ${v.placa}`,
          descricao: v.ipva_vencimento
            ? `Vence em ${fmtDateBR(v.ipva_vencimento)}`
            : "Pagamento pendente",
        });
      }
      const checkDoc = (
        tipo: string,
        keyPrefix: string,
        dataISO?: string | null,
      ) => {
        if (!dataISO) return;
        const dias = Math.ceil(
          (new Date(dataISO).getTime() - now) / DAY,
        );
        if (dias <= 30) {
          alerts.push({
            key: `${keyPrefix}:${v.id}:${dataISO}`,
            categoria: "Documento",
            titulo: dias < 0
              ? `${tipo} vencido — ${v.placa}`
              : `${tipo} vence em ${dias} dia(s) — ${v.placa}`,
            descricao: `Vencimento: ${fmtDateBR(dataISO)}`,
          });
        }
      };
      checkDoc("Seguro", "seguro", v.seguro_fim);
      checkDoc("CRLV", "crlv", v.crlv_vencimento);
    });

    // ---------- filtra reenvios do dia ----------
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data: jaEnviados } = await supabase
      .from("notifications_sent")
      .select("alert_key")
      .gte("sent_at", `${todayIso}T00:00:00Z`)
      .lte("sent_at", `${todayIso}T23:59:59Z`);
    const enviadosSet = new Set(
      (jaEnviados ?? []).map((r: any) => r.alert_key),
    );
    const novos = alerts.filter((a) => !enviadosSet.has(a.key));

    if (novos.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "Nenhum alerta novo hoje" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- destinatários (admins) ----------
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (roles ?? []).map((r: any) => r.user_id);
    if (adminIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, message: "Nenhum admin cadastrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, email, nome")
      .in("id", adminIds);
    const emails = (profilesData ?? [])
      .map((p: any) => p.email)
      .filter(Boolean);

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, message: "Nenhum e-mail de admin" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- monta HTML ----------
    const grupos: Record<string, Alert[]> = {};
    novos.forEach((a) => {
      (grupos[a.categoria] ||= []).push(a);
    });
    const dataStr = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const seções = Object.entries(grupos).map(([cat, list]) => `
      <h3 style="color:#0c2340;margin:24px 0 8px;">${cat} (${list.length})</h3>
      <ul style="padding-left:18px;margin:0;">
        ${list.map((a) =>
          `<li style="margin:6px 0;"><strong>${a.titulo}</strong><br/>
           <span style="color:#555;font-size:13px;">${a.descricao}</span></li>`
        ).join("")}
      </ul>
    `).join("");
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222;">
        <h2 style="color:#0c2340;border-bottom:2px solid #0c2340;padding-bottom:8px;">
          BRQ Frota — Alertas críticos
        </h2>
        <p style="color:#555;">Resumo do dia ${dataStr} — ${novos.length} alerta(s).</p>
        ${seções}
        <hr style="margin:32px 0;border:none;border-top:1px solid #eee;"/>
        <p style="font-size:12px;color:#888;">
          E-mail automático enviado pelo sistema BRQ Frota Interna.
        </p>
      </div>
    `;

    // ---------- envia ----------
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"BRQ Frota" <${gmailUser}>`,
      to: emails.join(", "),
      subject: `[BRQ Frota] ${novos.length} alerta(s) — ${dataStr}`,
      html,
    });

    // ---------- registra envio ----------
    await supabase.from("notifications_sent").insert(
      novos.map((a) => ({ alert_key: a.key })),
    );

    return new Response(
      JSON.stringify({
        ok: true,
        alertas: novos.length,
        destinatarios: emails.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
