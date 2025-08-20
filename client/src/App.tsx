import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Users, FileText, TrendingUp, Plus, Search, Filter } from 'lucide-react';
import { CaseList } from '@/components/CaseList';
import { CreateCaseDialog } from '@/components/CreateCaseDialog';
import { UserManagement } from '@/components/UserManagement';
// Type-only imports from server
import type { FraudCase, User, CaseStatus, CasePriority, CaseFilters } from '../../server/src/schema';
import type { CaseStatistics } from '../../server/src/handlers/get_case_statistics';

function App() {
  // Current user state (in real app, this would come from auth context)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [statistics, setStatistics] = useState<CaseStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState<CaseFilters>({});
  const [searchTxid, setSearchTxid] = useState('');

  // Load initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersData, casesData, statsData] = await Promise.all([
        trpc.getUsers.query(),
        trpc.getFraudCases.query({ 
          filters: { ...filters, txid: searchTxid || undefined },
          userId: currentUser?.id 
        }),
        trpc.getCaseStatistics.query({ userId: currentUser?.id })
      ]);
      
      setUsers(usersData);
      setCases(casesData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, filters, searchTxid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set demo current user (first admin user)
  useEffect(() => {
    if (users.length > 0 && !currentUser) {
      const adminUser = users.find(u => u.role === 'admin') || users[0];
      setCurrentUser(adminUser);
    }
  }, [users, currentUser]);

  const handleCreateCase = async (caseData: { txid: string; description: string; priority: CasePriority }) => {
    if (!currentUser) return;
    
    try {
      const newCase = await trpc.createFraudCase.mutate({
        ...caseData,
        created_by: currentUser.id
      });
      setCases(prev => [newCase, ...prev]);
      setShowCreateDialog(false);
      // Refresh statistics
      const updatedStats = await trpc.getCaseStatistics.query({ userId: currentUser.id });
      setStatistics(updatedStats);
    } catch (error) {
      console.error('Failed to create case:', error);
    }
  };

  const handleCaseUpdate = useCallback(() => {
    // Reload data when case is updated
    loadData();
  }, [loadData]);

  const getPriorityColor = (priority: CasePriority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: CaseStatus) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'escalated': return 'bg-red-100 text-red-800 border-red-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Case Management System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                🔒 Fraud Case Management System
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {currentUser && (
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="capitalize">
                    {currentUser.role}
                  </Badge>
                  <span className="text-sm text-gray-700">{currentUser.username}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="cases" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Cases
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* Statistics Cards */}
            {statistics && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.totalCases}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Critical Cases</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {statistics.casesByPriority.critical}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
                    <Users className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {statistics.unassignedCases}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Escalated</CardTitle>
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {statistics.escalatedCases}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Status Overview */}
            {statistics && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Cases by Status</CardTitle>
                    <CardDescription>Current case distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(statistics.casesByStatus).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <Badge className={getStatusColor(status as CaseStatus)}>
                            {status.replace('_', ' ')}
                          </Badge>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cases by Priority</CardTitle>
                    <CardDescription>Priority level distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(statistics.casesByPriority).map(([priority, count]) => (
                        <div key={priority} className="flex items-center justify-between">
                          <Badge className={getPriorityColor(priority as CasePriority)}>
                            {priority}
                          </Badge>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cases" className="space-y-6 mt-6">
            {/* Case Management Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">📋 Fraud Cases</h2>
                <p className="text-gray-600">Manage and track fraud investigation cases</p>
              </div>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-2" />
                New Case
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by Transaction ID..."
                      value={searchTxid}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTxid(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filters.status || 'all'} onValueChange={(value) => 
                    setFilters(prev => ({ ...prev, status: value === 'all' ? undefined : value as CaseStatus }))
                  }>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filters.priority || 'all'} onValueChange={(value) => 
                    setFilters(prev => ({ ...prev, priority: value === 'all' ? undefined : value as CasePriority }))
                  }>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Case List */}
            <CaseList 
              cases={cases}
              users={users}
              currentUser={currentUser}
              onCaseUpdate={handleCaseUpdate}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-6 mt-6">
            <UserManagement 
              users={users}
              currentUser={currentUser}
              onUsersUpdate={loadData}
            />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>📊 Analytics & Reports</CardTitle>
                <CardDescription>Detailed analytics and reporting features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Reports Coming Soon</h3>
                  <p className="text-gray-600">
                    Detailed analytics, performance metrics, and export capabilities will be available here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Case Dialog */}
      <CreateCaseDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateCase={handleCreateCase}
      />
    </div>
  );
}

export default App;