import React, { useState, useEffect } from 'react';
import { X, Shield, Check, RotateCcw, UserCog, User, Crown } from 'lucide-react';
import { 
  PERMISSIONS_BY_CATEGORY, 
  useUserPermissions, 
  useUpdateUserPermissions,
  useResetUserPermissions,
  getDefaultPermissionsForRole,
  PermissionCategory
} from '../../lib/hooks/useUserPermissions';
import { Role } from '../../lib/rbac/permissions';

interface PermissionsModalProps {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: Role;
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  userId,
  userName,
  userEmail,
  userRole,
  isOpen,
  onClose,
}) => {
  const { data: currentPermissions, isLoading } = useUserPermissions(userId);
  const updatePermissions = useUpdateUserPermissions();
  const resetPermissions = useResetUserPermissions();
  
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});
  const [hasCustomPermissions, setHasCustomPermissions] = useState(false);

  useEffect(() => {
    if (currentPermissions) {
      const permissions: Record<string, boolean> = {};
      Object.entries(currentPermissions).forEach(([key, value]) => {
        permissions[key] = value.has;
      });
      setSelectedPermissions(permissions);
      const hasCustom = Object.values(currentPermissions).some(p => p.source === 'custom');
      setHasCustomPermissions(hasCustom);
    }
  }, [currentPermissions]);

  const handleTogglePermission = (permission: string) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }));
  };

  const handleSelectAllInCategory = (category: PermissionCategory, select: boolean) => {
    const categoryPermissions = PERMISSIONS_BY_CATEGORY[category].map(p => p.id);
    setSelectedPermissions(prev => {
      const newPermissions = { ...prev };
      categoryPermissions.forEach(perm => {
        newPermissions[perm] = select;
      });
      return newPermissions;
    });
  };

  const handleResetToDefault = async () => {
    if (confirm('Resetar todas as permissões para o padrão do cargo?')) {
      await resetPermissions.mutateAsync(userId);
      setHasCustomPermissions(false);
    }
  };

  const handleSave = async () => {
    const permissionsToUpdate = Object.entries(selectedPermissions).map(([permission, granted]) => ({
      permission,
      granted,
    }));

    await updatePermissions.mutateAsync({
      userId,
      permissions: permissionsToUpdate,
    });
    
    onClose();
  };

  const getRoleIcon = () => {
    switch (userRole) {
      case 'adm': return <Crown className="w-5 h-5 text-emerald-400" />;
      case 'gestor': return <UserCog className="w-5 h-5 text-amber-400" />;
      case 'atendente': return <User className="w-5 h-5 text-blue-400" />;
    }
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'adm': return 'Administrador';
      case 'gestor': return 'Gestor';
      case 'atendente': return 'Atendente';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-800 flex justify-between items-start">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-200">Permissões do Usuário</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-400">{userName}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-500 text-sm">{userEmail}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {getRoleIcon()}
                <span className={`text-sm font-medium ${
                  userRole === 'adm' ? 'text-emerald-400' :
                  userRole === 'gestor' ? 'text-amber-400' : 'text-blue-400'
                }`}>
                  {getRoleLabel()}
                </span>
                {hasCustomPermissions && (
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                    Customizado
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToDefault}
              disabled={resetPermissions.isPending}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
            >
              <RotateCcw className="w-4 h-4" />
              Resetar
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-blue-400">
                  <strong>Como funciona:</strong> Marque ou desmarque as permissões abaixo para customizar 
                  o acesso deste usuário. Isso sobrescreve o padrão do cargo.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(PERMISSIONS_BY_CATEGORY).map(([category, permissions]) => {
                  const allSelected = permissions.every(p => selectedPermissions[p.id]);
                  
                  return (
                    <div key={category} className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
                        <h4 className="font-medium text-slate-300">{category}</h4>
                        <button
                          onClick={() => handleSelectAllInCategory(category as PermissionCategory, !allSelected)}
                          className={`text-xs px-2 py-1 rounded ${
                            allSelected ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                      </div>
                      
                      <div className="p-2 space-y-1">
                        {permissions.map((perm) => {
                          const isGranted = selectedPermissions[perm.id] || false;
                          
                          return (
                            <button
                              key={perm.id}
                              onClick={() => handleTogglePermission(perm.id)}
                              className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                                isGranted 
                                  ? 'bg-emerald-500/10 border border-emerald-500/30' 
                                  : 'bg-slate-900/50 border border-transparent hover:border-slate-700'
                              }`}
                            >
                              <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border ${
                                isGranted ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                              }`}>
                                {isGranted && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1">
                                <span className={`text-sm font-medium ${
                                  isGranted ? 'text-emerald-400' : 'text-slate-400'
                                }`}>
                                  {perm.label}
                                </span>
                                <p className="text-xs text-slate-500 mt-0.5">{perm.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-slate-200">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={updatePermissions.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {updatePermissions.isPending ? 'Salvando...' : <><Check className="w-4 h-4" /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionsModal;
