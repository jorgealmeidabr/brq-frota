import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useModulosBloqueados } from "@/hooks/useModulosBloqueados";
import { useToast } from "@/hooks/use-toast";
import type { ModuloPermissao } from "@/lib/types";

interface Props {
  modulo: ModuloPermissao;
  titulo?: string;
}

export function BlockedModuleScreen({ modulo, titulo }: Props) {
  const { unblock } = useModulosBloqueados();
  const { toast } = useToast();

  const handleReativar = async () => {
    try {
      await unblock(modulo);
      toast({ title: "Módulo reativado", description: `O módulo ${titulo ?? modulo} voltou a ficar disponível.` });
    } catch (e: any) {
      toast({ title: "Erro ao reativar", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Módulo Bloqueado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {titulo ? `O módulo "${titulo}" está desativado.` : "Este módulo está desativado."}
            <br />
            Os demais usuários não conseguem vê-lo nem acessá-lo.
          </p>
        </div>
        <Button onClick={handleReativar} className="gap-2">
          <Unlock className="h-4 w-4" /> Reativar módulo
        </Button>
      </Card>
    </div>
  );
}
