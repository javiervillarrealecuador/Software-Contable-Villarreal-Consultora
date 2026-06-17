'use client';

import { useState, useEffect } from 'react';

import { supabase } from '@/lib/supabase';

interface User {
  id: number;
  email: string;
  name?: string;
  active: boolean;
  role?: string;
  company_ids: number[];
}

interface Company {
  id: number;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  
  // Modal Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('ventas');
  const [formCompanyIds, setFormCompanyIds] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    
    // Load Users
    const { data: usersData, error: usersError } = await supabase.from('res_users').select('id, name, email, role, active, company_ids').order('id');
    if (!usersError && usersData) {
      setUsers(usersData);
    }

    // Load Companies
    const { data: compData, error: compError } = await supabase.from('res_company').select('id, name').order('id');
    if (!compError && compData) {
      setCompanies(compData);
    }

    setLoading(false);
  }

  async function toggleActive(user: User) {
    const { error } = await supabase.from('res_users').update({ active: !user.active }).eq('id', user.id);
    if (!error) {
      loadData();
    }
  }

  function handleCompanyToggle(companyId: number) {
    if (formCompanyIds.includes(companyId)) {
      setFormCompanyIds(formCompanyIds.filter(id => id !== companyId));
    } else {
      setFormCompanyIds([...formCompanyIds, companyId]);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (formCompanyIds.length === 0) {
      alert('Debes seleccionar al menos una empresa');
      return;
    }

    setInviting(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail,
          name: formName,
          role: formRole,
          company_ids: formCompanyIds
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error invitando usuario');
      }

      alert('Invitación enviada correctamente.');
      setIsModalOpen(false);
      
      // Reset Form
      setFormEmail('');
      setFormName('');
      setFormRole('ventas');
      setFormCompanyIds([]);
      
      loadData();
      
    } catch (error: any) {
      alert(error.message);
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="w-full">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-slate-500 text-sm mt-1">Invita y administra los accesos de tu equipo</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
        >
          + Invitar Usuario
        </button>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 animate-pulse">Cargando usuarios...</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresas Asignadas</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">{user.name || 'Sin nombre'}</div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-indigo-50 text-indigo-700 uppercase">
                      {user.role || 'Usuario'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <div className="flex flex-wrap gap-1">
                      {user.company_ids?.map(cid => {
                        const comp = companies.find(c => c.id === cid);
                        return comp ? (
                          <span key={cid} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs border border-slate-200">
                            {comp.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${user.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {user.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => toggleActive(user)}
                      className={`font-semibold ${user.active ? 'text-rose-600 hover:text-rose-800' : 'text-emerald-600 hover:text-emerald-800'}`}
                    >
                      {user.active ? 'Suspender' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="text-slate-400 mb-2">No hay usuarios registrados en tus empresas.</div>
                    <button onClick={() => setIsModalOpen(true)} className="text-blue-600 font-medium hover:underline">Invitar al primero</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL INVITAR USUARIO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Invitar Nuevo Usuario</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleInvite} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                    <input 
                      type="text" required
                      value={formName} onChange={e => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rol del Sistema</label>
                    <select 
                      value={formRole} onChange={e => setFormRole(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="admin">Administrador</option>
                      <option value="contador">Contador</option>
                      <option value="ventas">Ventas</option>
                      <option value="bodeguero">Bodeguero</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                  <input 
                    type="email" required
                    value={formEmail} onChange={e => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="correo@ejemplo.com"
                  />
                  <p className="text-xs text-slate-500 mt-1">Se enviará un correo para que establezca su contraseña.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Acceso a Empresas</label>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-40 overflow-y-auto space-y-2">
                    {companies.map(company => (
                      <label key={company.id} className="flex items-center space-x-3 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={formCompanyIds.includes(company.id)}
                          onChange={() => handleCompanyToggle(company.id)}
                          className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                        />
                        <span className="text-sm font-medium text-slate-700">{company.name}</span>
                      </label>
                    ))}
                    {companies.length === 0 && (
                      <span className="text-sm text-slate-500">No hay empresas disponibles.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={inviting || formCompanyIds.length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {inviting ? 'Enviando...' : 'Enviar Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
