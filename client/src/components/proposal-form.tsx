import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { proposalFormSchema, type ProposalForm } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface ProposalFormProps {
  formData: Partial<ProposalForm>;
  onFormChange: (data: Partial<ProposalForm>) => void;
  onGenerated: () => void;
}

export default function ProposalForm({ formData, onFormChange, onGenerated }: ProposalFormProps) {
  const { toast } = useToast();
  const [currentProposalId, setCurrentProposalId] = useState<string | null>(null);

  const form = useForm<ProposalForm>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      clientName: "",
      clientAddress: "",
      proposalDate: new Date().toISOString().split('T')[0],
      ...formData,
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: ProposalForm) => {
      const response = await apiRequest("POST", "/api/proposals", data);
      return response.json();
    },
    onSuccess: (proposal) => {
      setCurrentProposalId(proposal.id);
      toast({
        title: "Proposal saved",
        description: "Your proposal has been successfully saved.",
      });
      onGenerated();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generatePDFMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await fetch(`/api/proposals/${proposalId}/pdf`, {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `proposal-${form.getValues().clientName.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "PDF Generated",
        description: "Your proposal PDF has been downloaded.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFormChange = (values: ProposalForm) => {
    onFormChange(values);
  };

  const onSubmit = async (data: ProposalForm) => {
    await createProposalMutation.mutateAsync(data);
  };

  const handlePreview = async () => {
    const values = form.getValues();
    if (!form.formState.isValid) {
      toast({
        title: "Form Invalid",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
      return;
    }

    if (!currentProposalId) {
      await onSubmit(values);
    }
    
    if (currentProposalId) {
      await generatePDFMutation.mutateAsync(currentProposalId);
    }
  };

  const handleGenerate = async () => {
    const values = form.getValues();
    if (!form.formState.isValid) {
      toast({
        title: "Form Invalid",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
      return;
    }

    await onSubmit(values);
    if (currentProposalId) {
      await generatePDFMutation.mutateAsync(currentProposalId);
    }
  };

  const handleReset = () => {
    form.reset({
      clientName: "",
      clientAddress: "",
      proposalDate: new Date().toISOString().split('T')[0],
      investmentAmount: 150000,
      targetReturn: 72,
      timeHorizon: 3,
      year1Dividend: 1.440,
      year2Dividend: 1.888,
      year3Dividend: 2.378,
    });
    setCurrentProposalId(null);
    onFormChange({
      investmentAmount: 150000,
      targetReturn: 72,
      timeHorizon: 3,
      year1Dividend: 1.440,
      year2Dividend: 1.888,
      year3Dividend: 2.378,
    });
  };

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Client Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <i className="fas fa-user-tie text-accent mr-3"></i>
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter client's full name"
                        onChange={(e) => {
                          field.onChange(e);
                          handleFormChange(form.getValues());
                        }}
                        data-testid="input-client-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Address</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter client's complete address"
                        rows={3}
                        className="resize-none"
                        onChange={(e) => {
                          field.onChange(e);
                          handleFormChange(form.getValues());
                        }}
                        data-testid="input-client-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="proposalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposal Date</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        onChange={(e) => {
                          field.onChange(e);
                          handleFormChange(form.getValues());
                        }}
                        data-testid="input-proposal-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Investment Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <i className="fas fa-chart-line text-accent mr-3"></i>
                Investment Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <FormField
                control={form.control}
                name="investmentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Investment Amount (R)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground font-medium">R</span>
                        <Input
                          {...field}
                          type="number"
                          placeholder="150000"
                          min={1000}
                          step={1000}
                          className="pl-8"
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                            handleFormChange(form.getValues());
                          }}
                          data-testid="input-investment-amount"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="targetReturn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Return (%)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="72"
                          min={1}
                          max={200}
                          step={1}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                            handleFormChange(form.getValues());
                          }}
                          data-testid="input-target-return"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeHorizon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Horizon (Years)</FormLabel>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) => {
                          field.onChange(parseInt(value));
                          handleFormChange(form.getValues());
                        }}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-time-horizon">
                            <SelectValue placeholder="Select time horizon" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="3">3 Years</SelectItem>
                          <SelectItem value="5">5 Years</SelectItem>
                          <SelectItem value="7">7 Years</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dividend Allocation Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <i className="fas fa-percentage text-accent mr-3"></i>
                Dividend Allocation Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="year1Dividend"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year 1 Allocation</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="1.440"
                          step={0.001}
                          min={0}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                            handleFormChange(form.getValues());
                          }}
                          data-testid="input-year1-dividend"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year2Dividend"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year 2 Allocation</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="1.888"
                          step={0.001}
                          min={0}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                            handleFormChange(form.getValues());
                          }}
                          data-testid="input-year2-dividend"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year3Dividend"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year 3 Allocation</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="2.378"
                          step={0.001}
                          min={0}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                            handleFormChange(form.getValues());
                          }}
                          data-testid="input-year3-dividend"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Alert>
                <i className="fas fa-info-circle text-accent mr-2"></i>
                <AlertDescription>
                  Dividend allocation represents the distribution per share. Calculations will be automatically generated based on these values.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Document Generation Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <i className="fas fa-file-pdf text-accent mr-3"></i>
                Document Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-card-foreground">Private Equity Proposal Template</h3>
                    <p className="text-sm text-muted-foreground">Opian Capital - Customized Investment Proposal</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center">
                      <i className="fas fa-file-pdf text-white text-sm"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  type="button"
                  onClick={handlePreview}
                  disabled={generatePDFMutation.isPending}
                  className="flex items-center justify-center"
                  data-testid="button-preview-pdf"
                >
                  <i className="fas fa-eye mr-2"></i>
                  Preview PDF
                </Button>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={createProposalMutation.isPending || generatePDFMutation.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center"
                  data-testid="button-generate-download"
                >
                  <i className="fas fa-download mr-2"></i>
                  Generate & Download
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Footer Actions */}
      <div className="mt-12 border-t border-border pt-8">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-reset-form"
            >
              <i className="fas fa-undo mr-2"></i>
              Reset Form
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-load-template"
            >
              <i className="fas fa-upload mr-2"></i>
              Load Template
            </Button>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              type="submit"
              variant="outline"
              disabled={createProposalMutation.isPending}
              data-testid="button-save-draft"
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={createProposalMutation.isPending || generatePDFMutation.isPending}
              className="flex items-center"
              data-testid="button-generate-final"
            >
              <i className="fas fa-file-export mr-2"></i>
              Generate Final Document
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
