import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockedModules } from "@/hooks/useBlockedModules";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import type { ModuloPermissao } from "@/lib/types";

export function ModuloBloqueadoPage({ modulo }: { modulo: ModuloPermissao }) {
  const { isAdmin } = usePermissions();
  const { setModuleBlocked } = useBlockedModules();

  const unblock = async () => {
    const { error } = await setModuleBlocked(modulo, false);
    if (error) toast.error(error);
    else toast.success(`Módulo "${modulo}" reativado.`);
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-bold">Módulo bloqueado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O módulo <span className="font-mono">{modulo}</span> está desativado pelo administrador.
          Nenhuma informação é enviada ou recebida enquanto estiver bloqueado.
        </p>
      </div>
      {isAdmin && (
        <Button onClick={unblock} variant="brand">
          <Unlock className="mr-2 h-4 w-4" />
          Reativar módulo
        </Button>
      )}
    </div>
  );
}
