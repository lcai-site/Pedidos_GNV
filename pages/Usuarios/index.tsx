import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2,
  Power,
  PowerOff,
  Key,
  User,
  UserCog,
  Crown,
  Mail,
  AlertCircle,
  X,
  Shield
} from 'lucide-react';
import { 
  useUsuarios, 
  useCreateUsuario, 
  useUpdateUsuario, 
  useToggleUsuarioStatus,
  useReenviarConvite,
  type Usuario 
} from '../../lib/hooks/useUsuarios';
import { PermissionsModal } from '../../components/Usuarios/PermissionsModal';
import { useAuth } from '../../lib/contexts/AuthContext';
import { RoleGuard } from '../../components/RBAC/RoleGuard';
import { CanAccess } from '../../components/RBAC/CanAccess';
import { SectionHeader } from '../../components/ui/SectionHeader';

const ROLE_CONFIG = {
  atendente: { 
    label: 'Atendente', 
    icon: User, 
    color: 'blue',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30'
  },
  gestor: { 
    label: 'Gestor', 
    icon: UserCog, 
    color: 'amber',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30'
  },
  adm: { 
    label: 'Administrador', 
    icon: Crown, 
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30'
  }
};

export const UsuariosPage: React.FC = () => {
  const { profile, can } = useAuth();
  const { data: usuarios, isLoading } = useUsuarios();
  const createUsuario = useCreateUsuario();
  const updateUsuario = useUpdateUsuario();
  const toggleStatus = useToggleUsuarioStatus();
  const reenviarConvite = useReenviarConvite();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<Usuario | null>(null);
  
  const canManage = (target: Usuario) => {
    if (can('usuarios:manage_all')) return true;
    if (can('usuarios:manage_atendentes') && target.role === 'atendente') return true;
    return false;
  };

  const [formData, setFormData] = useState({
    nome_completo: '',
    email: '',
      role: 'atendente' as 'atendente' | 'gestor' | 'adm',
    vendedora_nome: '',
    meta_mensal: ''
  });

  const filteredUsuarios = usuarios?.filter(user => {
    const matchesSearch = 
      user.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.vendedora_nome?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'ativo' && user.ativo) ||
      (filterStatus === 'inativo' && !user.ativo);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: usuarios?.length || 0,
    ativos: usuarios?.filter(u => u.ativo).length || 0,
    inativos: usuarios?.filter(u => !u.ativo).length || 0,
    atendentes: usuarios?.filter(u => u.role === 'atendente').length || 0,
    gestores: usuarios?.filter(u => u.role === 'gestor').length || 0,
    admins: usuarios?.filter(u => u.role === 'adm').length || 0
  };

  const handleOpenModal = (usuario?: Usuario) => {
    if (usuario) {
      setEditingUsuario(usuario);
      setFormData({
        nome_completo: usuario.nome_completo || '',
        email: usuario.email,
        role: usuario.role,
        vendedora_nome: usuario.vendedora_nome || '',
        meta_mensal: usuario.meta_mensal?.toString() || ''
      });
    } else {
      setEditingUsuario(null);
      setFormData({
        nome_completo: '',
        email: '',
        role: 'atendente' as 'atendente' | 'gestor' | 'adm',
        vendedora_nome: '',
        meta_mensal: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUsuario) {
      await updateUsuario.mutateAsync({
        id: editingUsuario.id,
        nome_completo: formData.nome_completo,
        role: formData.role,
        vendedora_nome: formData.vendedora_nome || null,
        meta_mensal: formData.meta_mensal ? Number(formData.meta_mensal) : null
      });
    } else {
      await createUsuario.mutateAsync({
        nome_completo: formData.nome_completo,
        email: formData.email,
        role: formData.role,
        vendedora_nome: formData.vendedora_nome,
        meta_mensal: formData.meta_mensal ? Number(formData.meta_mensal) : undefined
      });
    }
    
    setShowModal(false);
  };

  const handleToggleStatus = async (usuario: Usuario) => {
    if (usuario.id === profile?.id) {
      alert('Você não pode desativar seu próprio usuário!');
      return;
    }
    await toggleStatus.mutateAsync({ id: usuario.id, ativo: !usuario.ativo });
  };

  const handleReenviarConvite = async (email: string, role?: string) => {
    if (confirm(`Reenviar convite de acesso para ${email}?`)) {
      await reenviarConvite.mutateAsync(email);
    }
  };

  const handleOpenPermissions = (usuario: Usuario) => {
    setSelectedUserForPermissions(usuario);
    setShowPermissionsModal(true);
  };

  return (
    <RoleGuard allowedRoles={['gestor', 'adm']}>
      <div className="space-y-6">
        <SectionHeader
          title="Gerenciamento de Usuários"
          subtitle="Gerencie os usuários do sistema e suas permissões"
          icon={Users}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-200">{stats.total}</div>
            <div className="text-xs text-slate-500 uppercase">Total</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-400">{stats.ativos}</div>
            <div className="text-xs text-slate-500 uppercase">Ativos</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-rose-400">{stats.inativos}</div>
            <div className="text-xs text-slate-500 uppercase">Inativos</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.atendentes}</div>
            <div className="text-xs text-slate-500 uppercase">Atendentes</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-400">{stats.gestores}</div>
            <div className="text-xs text-slate-500 uppercase">Gestores</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-400">{stats.admins}</div>
            <div className="text-xs text-slate-500 uppercase">Admins</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 w-full md:w-64"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200"
            >
              <option value="all">Todos os cargos</option>
              <option value="atendente">Atendentes</option>
              <option value="gestor">Gestores</option>
              <option value="adm">Administradores</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200"
            >
              <option value="all">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>

          <CanAccess permissions={['usuarios:manage_all', 'usuarios:manage_atendentes']}>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Usuário
            </button>
          </CanAccess>
        </div>

        {/* Lista */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">
              <div className="animate-spin h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4" />
              Carregando usuários...
            </div>
          ) : filteredUsuarios?.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredUsuarios?.map((usuario) => {
                const roleConfig = ROLE_CONFIG[usuario.role] || { 
                  label: 'Desconhecido', 
                  icon: User, 
                  bgColor: 'bg-slate-500/10',
                  textColor: 'text-slate-400',
                  borderColor: 'border-slate-500/30'
                };
                const RoleIcon = roleConfig.icon;
                const isCurrentUser = usuario.id === profile?.id;

                return (
                  <div 
                    key={usuario.id} 
                    className={`flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors ${
                      !usuario.ativo ? 'opacity-60' : ''
                    } ${isCurrentUser ? 'bg-emerald-500/5' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${roleConfig.bgColor}`}>
                        <RoleIcon className={`w-5 h-5 ${roleConfig.textColor}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">
                            {usuario.nome_completo || 'Sem nome'}
                          </span>
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded">Você</span>
                          )}
                          {!usuario.ativo && (
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs rounded">Inativo</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {usuario.email}
                          </span>
                          {usuario.vendedora_nome && <span>• {usuario.vendedora_nome}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${roleConfig.bgColor} ${roleConfig.textColor} ${roleConfig.borderColor}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleConfig.label}
                      </span>

                      {usuario.meta_mensal && (
                        <span className="text-sm text-slate-500">
                          Meta: R$ {usuario.meta_mensal.toLocaleString()}
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        {canManage(usuario) && (
                          <>
                            <button
                              onClick={() => handleOpenPermissions(usuario)}
                              className="p-2 text-slate-400 hover:text-purple-400 rounded-lg hover:bg-purple-500/20"
                              title="Gerenciar Permissões"
                            >
                              <Shield className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleOpenModal(usuario)}
                              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleReenviarConvite(usuario.email)}
                              className="p-2 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-amber-500/20"
                              title="Reenviar convite"
                            >
                              <Mail className="w-4 h-4" />
                            </button>

                            {!isCurrentUser && (
                              <button
                                onClick={() => handleToggleStatus(usuario)}
                                className={`p-2 rounded-lg ${
                                  usuario.ativo 
                                    ? 'text-emerald-400 hover:bg-emerald-500/20' 
                                    : 'text-rose-400 hover:bg-rose-500/20'
                                }`}
                                title={usuario.ativo ? 'Desativar' : 'Ativar'}
                              >
                                {usuario.ativo ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de Permissões */}
        {showPermissionsModal && selectedUserForPermissions && (
          <PermissionsModal
            userId={selectedUserForPermissions.id}
            userName={selectedUserForPermissions.nome_completo || selectedUserForPermissions.email}
            userEmail={selectedUserForPermissions.email}
            userRole={selectedUserForPermissions.role}
            isOpen={showPermissionsModal}
            onClose={() => {
              setShowPermissionsModal(false);
              setSelectedUserForPermissions(null);
            }}
          />
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-200">
                    {editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {editingUsuario ? 'Atualize as informações' : 'Crie um novo usuário'}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    value={formData.nome_completo}
                    onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!!editingUsuario}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 disabled:opacity-50"
                    required
                  />
                </div>

                <CanAccess permissions={['usuarios:manage_all', 'usuarios:manage_atendentes']}>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Cargo *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(ROLE_CONFIG) as Array<keyof typeof ROLE_CONFIG>).map((role) => {
                        const config = ROLE_CONFIG[role];
                        const Icon = config.icon;
                        // Regra de segurança: Gestor só pode atribuir cargo atendente ou gestor (não adm)
                        // ADM pode tudo
                        if (role === 'adm' && !can('usuarios:manage_all')) return null;
                        
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setFormData({ ...formData, role })}
                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                              formData.role === role
                                ? `${config.bgColor} ${config.borderColor} ${config.textColor}`
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs font-medium">{config.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CanAccess>

                {formData.role === 'atendente' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Nome de Vendedora</label>
                      <input
                        type="text"
                        value={formData.vendedora_nome}
                        onChange={(e) => setFormData({ ...formData, vendedora_nome: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Meta Mensal</label>
                      <input
                        type="number"
                        value={formData.meta_mensal}
                        onChange={(e) => setFormData({ ...formData, meta_mensal: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200"
                      />
                    </div>
                  </>
                )}

                {!editingUsuario && (
                  <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <Mail className="w-4 h-4 text-emerald-400 mt-0.5" />
                    <div className="text-xs text-emerald-400">
                      <p className="font-medium">Convite por email</p>
                      <p>O usuário receberá um email com um link para criar sua própria senha e acessar o sistema.</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2 text-slate-400 hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createUsuario.isPending || updateUsuario.isPending}
                    className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {createUsuario.isPending || updateUsuario.isPending
                      ? 'Salvando...'
                      : editingUsuario ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
};

export default UsuariosPage;
