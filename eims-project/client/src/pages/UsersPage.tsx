import { useState, useEffect } from 'react';
import { usersApi } from '@/services/api';
import { User, Role } from '@/types';
import Modal from '@/components/Modal';
import { Plus, Search, Users as UsersIcon, Edit, Trash2, MoreVertical } from 'lucide-react';

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'STUDENT' as Role,
    studentNumber: '',
    facultyId: '',
    department: '',
    program: '',
    yearLevel: 1,
    section: '',
    designation: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await usersApi.list({ search: search || undefined, role: roleFilter || undefined });
      setUsers(res.data.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  const resetForm = () => {
    setFormData({
      email: '', password: '', firstName: '', lastName: '', role: 'STUDENT' as Role,
      studentNumber: '', facultyId: '', department: '', program: '', yearLevel: 1, section: '', designation: '',
    });
    setFormError('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await usersApi.create(formData);
      setShowCreateModal(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormLoading(true);
    setFormError('');
    try {
      const { password, ...updateData } = formData;
      await usersApi.update(selectedUser._id || selectedUser.id!, updateData);
      setShowEditModal(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to update user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setFormLoading(true);
    try {
      await usersApi.delete(selectedUser._id || selectedUser.id!);
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      setFormError(error.response?.data?.error?.message || 'Failed to deactivate user');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      studentNumber: user.studentNumber || '',
      facultyId: user.facultyId || '',
      department: user.department || '',
      program: user.program || '',
      yearLevel: user.yearLevel || 1,
      section: user.section || '',
      designation: '',
    });
    setShowEditModal(true);
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case Role.ADMIN: return 'badge-danger';
      case Role.FACULTY: return 'badge-primary';
      case Role.STUDENT: return 'badge-success';
      default: return 'badge-gray';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage system users</p>
        </div>
        <button onClick={() => { resetForm(); setShowCreateModal(true); }} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input w-40">
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="FACULTY">Faculty</option>
          <option value="STUDENT">Student</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="card p-12 text-center">
          <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Program/Dept</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u._id || u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-600">{u.firstName?.[0]}{u.lastName?.[0]}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${getRoleBadge(u.role)}`}>{u.role}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.studentNumber || u.facultyId || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.department || u.program || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditModal(u)} className="p-1 text-gray-400 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => { setSelectedUser(u); setShowDeleteModal(true); }} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Add New User" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })} className="input">
                <option value="STUDENT">Student</option>
                <option value="FACULTY">Faculty</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            {formData.role === 'STUDENT' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student Number</label>
                  <input type="text" value={formData.studentNumber} onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                  <input type="text" value={formData.program} onChange={(e) => setFormData({ ...formData, program: e.target.value })} className="input" placeholder="BSCS" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                  <input type="number" value={formData.yearLevel} onChange={(e) => setFormData({ ...formData, yearLevel: parseInt(e.target.value) })} className="input" min={1} max={5} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input type="text" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} className="input" placeholder="A" />
                </div>
              </>
            )}
            {formData.role === 'FACULTY' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Faculty ID</label>
                  <input type="text" value={formData.facultyId} onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                  <input type="text" value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })} className="input" placeholder="Instructor" />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Creating...' : 'Create User'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit User" size="lg">
        <form onSubmit={handleEdit} className="space-y-4">
          {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{formError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })} className="input">
                <option value="STUDENT">Student</option>
                <option value="FACULTY">Faculty</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            {formData.role === 'STUDENT' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student Number</label>
                  <input type="text" value={formData.studentNumber} onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
                  <input type="text" value={formData.program} onChange={(e) => setFormData({ ...formData, program: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                  <input type="number" value={formData.yearLevel} onChange={(e) => setFormData({ ...formData, yearLevel: parseInt(e.target.value) })} className="input" min={1} max={5} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input type="text" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })} className="input" />
                </div>
              </>
            )}
            {formData.role === 'FACULTY' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Faculty ID</label>
                  <input type="text" value={formData.facultyId} onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="input" />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={formLoading} className="btn btn-primary">{formLoading ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Deactivate User" size="sm">
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to deactivate <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong>?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleDelete} disabled={formLoading} className="btn btn-danger">{formLoading ? 'Deactivating...' : 'Deactivate'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UsersPage;
