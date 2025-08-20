import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Users, Plus, Shield, User as UserIcon, Eye } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { User, UserRole, CreateUserInput } from '../../../server/src/schema';

interface UserManagementProps {
  users: User[];
  currentUser: User | null;
  onUsersUpdate: () => void;
}

export function UserManagement({ users, currentUser, onUsersUpdate }: UserManagementProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateUserInput>({
    username: '',
    email: '',
    role: 'viewer'
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'investigator': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'analyst': return 'bg-green-100 text-green-800 border-green-200';
      case 'viewer': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return '👑';
      case 'investigator': return '🔍';
      case 'analyst': return '📊';
      case 'viewer': return '👀';
      default: return '👤';
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Full system access - can manage users and all cases';
      case 'investigator': return 'Can create, update, and escalate cases';
      case 'analyst': return 'Can view and analyze cases, limited editing';
      case 'viewer': return 'Read-only access to assigned cases';
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (users.some(u => u.username === formData.username)) {
      newErrors.username = 'Username already exists';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    } else if (users.some(u => u.email === formData.email)) {
      newErrors.email = 'Email already exists';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsCreating(true);
    try {
      await trpc.createUser.mutate(formData);
      setFormData({
        username: '',
        email: '',
        role: 'viewer'
      });
      setErrors({});
      setShowCreateDialog(false);
      onUsersUpdate();
    } catch (error) {
      console.error('Failed to create user:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const canManageUsers = () => {
    return currentUser?.role === 'admin';
  };

  const getUserStats = () => {
    const roleStats = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: users.length,
      admins: roleStats.admin || 0,
      investigators: roleStats.investigator || 0,
      analysts: roleStats.analyst || 0,
      viewers: roleStats.viewer || 0
    };
  };

  const stats = getUserStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">👥 User Management</h2>
          <p className="text-gray-600">Manage system users and their access permissions</p>
        </div>
        {canManageUsers() && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData(prev => ({ ...prev, username: e.target.value }))
                    }
                    placeholder="Enter username..."
                    className={errors.username ? 'border-red-300' : ''}
                    disabled={isCreating}
                  />
                  {errors.username && <p className="text-sm text-red-600">{errors.username}</p>}
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData(prev => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="user@company.com"
                    className={errors.email ? 'border-red-300' : ''}
                    disabled={isCreating}
                  />
                  {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                </div>
                
                <div>
                  <Label>Role *</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
                    disabled={isCreating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="analyst">Analyst</SelectItem>
                      <SelectItem value="investigator">Investigator</SelectItem>
                      {currentUser?.role === 'admin' && (
                        <SelectItem value="admin">Administrator</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600 mt-1">
                    {getRoleDescription(formData.role)}
                  </p>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating...' : 'Create User'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.admins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investigators</CardTitle>
            <UserIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.investigators}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Viewers</CardTitle>
            <Eye className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.viewers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>
            All registered users and their access levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getRoleIcon(user.role)}</span>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          {currentUser?.id === user.id && (
                            <p className="text-xs text-blue-600">You</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {user.created_at.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-700 border-green-200">
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle>🔒 Role Permissions</CardTitle>
          <CardDescription>
            Understanding user access levels and capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {(['admin', 'investigator', 'analyst', 'viewer'] as UserRole[]).map((role) => (
              <div key={role} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{getRoleIcon(role)}</span>
                  <Badge className={getRoleColor(role)}>
                    {role}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {getRoleDescription(role)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}