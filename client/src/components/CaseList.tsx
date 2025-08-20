import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Clock, User as UserIcon, ArrowUp, Eye, Edit, UserPlus } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { FraudCase, User, CaseStatus, CasePriority } from '../../../server/src/schema';

interface CaseListProps {
  cases: FraudCase[];
  users: User[];
  currentUser: User | null;
  onCaseUpdate: () => void;
}

export function CaseList({ cases, users, currentUser, onCaseUpdate }: CaseListProps) {
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');
  const [newPriority, setNewPriority] = useState<CasePriority>('high');
  const [isUpdating, setIsUpdating] = useState(false);

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

  const getAssignedUser = (userId: number | null) => {
    if (!userId) return null;
    return users.find(user => user.id === userId);
  };

  const getCreatorUser = (userId: number) => {
    return users.find(user => user.id === userId);
  };

  const handleAssignCase = async (caseId: number, assignedTo: number) => {
    if (!currentUser) return;
    
    setIsUpdating(true);
    try {
      await trpc.assignCase.mutate({
        caseId,
        assignedTo,
        assignedBy: currentUser.id
      });
      onCaseUpdate();
    } catch (error) {
      console.error('Failed to assign case:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (caseId: number, newStatus: CaseStatus) => {
    if (!currentUser) return;
    
    setIsUpdating(true);
    try {
      await trpc.updateFraudCase.mutate({
        case: { id: caseId, status: newStatus },
        userId: currentUser.id
      });
      onCaseUpdate();
    } catch (error) {
      console.error('Failed to update case status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEscalateCase = async () => {
    if (!selectedCase || !currentUser) return;
    
    setIsUpdating(true);
    try {
      await trpc.escalateCase.mutate({
        case_id: selectedCase.id,
        escalated_by: currentUser.id,
        new_priority: newPriority,
        reason: escalationReason
      });
      setShowEscalateDialog(false);
      setEscalationReason('');
      setSelectedCase(null);
      onCaseUpdate();
    } catch (error) {
      console.error('Failed to escalate case:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseCase = async (caseId: number) => {
    if (!currentUser) return;
    
    setIsUpdating(true);
    try {
      await trpc.closeCase.mutate({
        caseId,
        userId: currentUser.id,
        resolution: 'Case resolved successfully'
      });
      onCaseUpdate();
    } catch (error) {
      console.error('Failed to close case:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const canEditCase = (fraudCase: FraudCase) => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || 
           currentUser.role === 'investigator' || 
           fraudCase.assigned_to === currentUser.id;
  };

  const canAssignCase = () => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.role === 'investigator';
  };

  if (cases.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Cases Found</h3>
            <p className="text-gray-600 mb-4">
              No fraud cases match your current filters. Try adjusting your search criteria.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {cases.map((fraudCase: FraudCase) => {
        const assignedUser = getAssignedUser(fraudCase.assigned_to);
        const creatorUser = getCreatorUser(fraudCase.created_by);
        
        return (
          <Card key={fraudCase.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">Case #{fraudCase.id}</CardTitle>
                    <Badge className={getStatusColor(fraudCase.status)}>
                      {fraudCase.status.replace('_', ' ')}
                    </Badge>
                    <Badge className={getPriorityColor(fraudCase.priority)}>
                      {fraudCase.priority}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      🔗 TXID: <strong>{fraudCase.txid}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {fraudCase.created_at.toLocaleDateString()}
                    </span>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Case #{fraudCase.id} Details</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-600">Transaction ID</label>
                            <p className="font-mono text-sm bg-gray-100 p-2 rounded">{fraudCase.txid}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Status</label>
                            <p>
                              <Badge className={getStatusColor(fraudCase.status)}>
                                {fraudCase.status.replace('_', ' ')}
                              </Badge>
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Priority</label>
                            <p>
                              <Badge className={getPriorityColor(fraudCase.priority)}>
                                {fraudCase.priority}
                              </Badge>
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Assigned To</label>
                            <p>{assignedUser ? assignedUser.username : 'Unassigned'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Created By</label>
                            <p>{creatorUser?.username || 'Unknown'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Created At</label>
                            <p>{fraudCase.created_at.toLocaleString()}</p>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Description</label>
                          <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded">
                            {fraudCase.description}
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {canEditCase(fraudCase) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedCase(fraudCase);
                        setShowEscalateDialog(true);
                      }}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <ArrowUp className="h-4 w-4 mr-1" />
                      Escalate
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">{fraudCase.description}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <UserIcon className="h-4 w-4" />
                      Created by: {creatorUser?.username || 'Unknown'}
                    </span>
                    {assignedUser && (
                      <span className="flex items-center gap-1">
                        <UserPlus className="h-4 w-4" />
                        Assigned to: {assignedUser.username}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {canAssignCase() && !fraudCase.assigned_to && (
                      <Select onValueChange={(value) => handleAssignCase(fraudCase.id, parseInt(value))}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {users
                            .filter(user => user.role === 'investigator' || user.role === 'analyst')
                            .map(user => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.username}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    )}
                    
                    {canEditCase(fraudCase) && fraudCase.status !== 'closed' && (
                      <Select 
                        value={fraudCase.status} 
                        onValueChange={(value: CaseStatus) => handleStatusChange(fraudCase.id, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Close</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    
                    {canEditCase(fraudCase) && fraudCase.status === 'resolved' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleCloseCase(fraudCase.id)}
                        disabled={isUpdating}
                      >
                        Close Case
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* Escalation Dialog */}
      <Dialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🚨 Escalate Case #{selectedCase?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">New Priority Level</label>
              <Select value={newPriority} onValueChange={(value: CasePriority) => setNewPriority(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Escalation Reason</label>
              <Textarea
                value={escalationReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEscalationReason(e.target.value)}
                placeholder="Explain why this case needs to be escalated..."
                className="mt-1"
                rows={4}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEscalateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleEscalateCase}
                disabled={!escalationReason.trim() || isUpdating}
                className="bg-red-600 hover:bg-red-700"
              >
                {isUpdating ? 'Escalating...' : 'Escalate Case'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}