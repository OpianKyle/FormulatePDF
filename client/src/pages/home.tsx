import ProposalForm from "@/components/proposal-form";
import CalculationsPanel from "@/components/calculations-panel";
import { useState } from "react";
import type { ProposalForm as ProposalFormData } from "@shared/schema";

export default function Home() {
  const [formData, setFormData] = useState<Partial<ProposalFormData>>({
    investmentAmount: 150000,
    targetReturn: 72,
    timeHorizon: 3,
    year1Dividend: 1.440,
    year2Dividend: 1.888,
    year3Dividend: 2.378,
  });

  const [lastGenerated, setLastGenerated] = useState<string>("Never");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-secondary text-secondary-foreground w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">
                O
              </div>
              <div>
                <h1 className="text-xl font-semibold">Opian Capital</h1>
                <p className="text-sm text-secondary opacity-90">PDF Form Digitization Tool</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors font-medium"
                data-testid="button-save-draft"
              >
                <i className="fas fa-save mr-2"></i>Save Draft
              </button>
              <button 
                className="border border-secondary text-secondary px-4 py-2 rounded-md hover:bg-secondary hover:text-secondary-foreground transition-colors font-medium"
                data-testid="button-help"
              >
                <i className="fas fa-question-circle mr-2"></i>Help
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Form */}
          <ProposalForm 
            formData={formData} 
            onFormChange={setFormData}
            onGenerated={() => setLastGenerated(new Date().toLocaleString())}
          />
          
          {/* Right Panel - Calculations */}
          <CalculationsPanel 
            formData={formData}
            lastGenerated={lastGenerated}
          />
        </div>
      </div>
    </div>
  );
}
