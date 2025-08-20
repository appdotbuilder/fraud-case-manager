import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertTriangle, FileText } from 'lucide-react';
import type { CasePriority } from '../../../server/src/schema';

interface CreateCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCase: (caseData: { 
    txid: string; 
    description: string; 
    priority: CasePriority;
  }) => Promise<void>;
}

export function CreateCaseDialog({ open, onOpenChange, onCreateCase }: CreateCaseDialogProps) {
  const [formData, setFormData] = useState({
    txid: '',
    description: '',
    priority: 'medium' as CasePriority
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!formData.txid.trim()) {
      newErrors.txid = 'Transaction ID is required';
    } else if (formData.txid.length < 3) {
      newErrors.txid = 'Transaction ID must be at least 3 characters';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await onCreateCase(formData);
      // Reset form on success
      setFormData({
        txid: '',
        description: '',
        priority: 'medium'
      });
      setErrors({});
    } catch (error) {
      console.error('Failed to create case:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        txid: '',
        description: '',
        priority: 'medium'
      });
      setErrors({});
      onOpenChange(false);
    }
  };

  const getPriorityDescription = (priority: CasePriority) => {
    switch (priority) {
      case 'critical': return '🔴 Immediate attention required - potential major financial loss';
      case 'high': return '🟠 Urgent - significant impact on operations or customers';
      case 'medium': return '🟡 Standard priority - normal investigation timeline';
      case 'low': return '🟢 Low impact - can be handled with regular workflow';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            🚨 Report New Fraud Case
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4">
            {/* Transaction ID */}
            <div className="space-y-2">
              <Label htmlFor="txid" className="text-sm font-medium">
                Transaction ID *
              </Label>
              <Input
                id="txid"
                value={formData.txid}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData(prev => ({ ...prev, txid: e.target.value }))
                }
                placeholder="Enter the suspicious transaction ID..."
                className={errors.txid ? 'border-red-300 focus:border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.txid && (
                <p className="text-sm text-red-600">{errors.txid}</p>
              )}
              <p className="text-xs text-gray-500">
                The unique identifier for the suspicious transaction
              </p>
            </div>

            {/* Priority Level */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Priority Level *
              </Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value: CasePriority) => 
                  setFormData(prev => ({ ...prev, priority: value }))
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="critical">Critical Priority</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600">
                {getPriorityDescription(formData.priority)}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Incident Description *
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData(prev => ({ ...prev, description: e.target.value }))
                }
                placeholder="Provide detailed information about the suspected fraudulent activity..."
                rows={6}
                className={errors.description ? 'border-red-300 focus:border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.description && (
                <p className="text-sm text-red-600">{errors.description}</p>
              )}
              <p className="text-xs text-gray-500">
                Include all relevant details: amount, parties involved, suspicious patterns, etc.
              </p>
            </div>
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <h4 className="font-medium text-blue-900 mb-1">
                  📋 Case Creation Guidelines
                </h4>
                <ul className="text-blue-700 space-y-1 text-xs">
                  <li>• Provide a unique and accurate Transaction ID</li>
                  <li>• Select appropriate priority based on potential impact</li>
                  <li>• Include all available evidence and suspicious indicators</li>
                  <li>• Cases will be automatically assigned status: "Open"</li>
                  <li>• You will be recorded as the case creator</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating Case...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Create Fraud Case
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}