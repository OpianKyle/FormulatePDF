import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateInvestmentProjections } from "@/lib/calculations";
import type { ProposalForm } from "@shared/schema";

interface CalculationsPanelProps {
  formData: Partial<ProposalForm>;
  lastGenerated: string;
}

export default function CalculationsPanel({ formData, lastGenerated }: CalculationsPanelProps) {
  const calculations = calculateInvestmentProjections(formData);

  return (
    <div className="space-y-8">
      {/* Real-time Calculations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <i className="fas fa-calculator text-accent mr-3"></i>
            Live Calculations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-r from-primary to-accent p-4 rounded-lg text-primary-foreground">
            <div className="flex justify-between items-center">
              <span className="font-medium">Target Investment Value</span>
              <span className="text-xl font-bold" data-testid="text-target-value">
                R {calculations.targetValue.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Profit</div>
              <div className="text-lg font-semibold text-accent" data-testid="text-total-profit">
                R {calculations.totalProfit.toLocaleString()}
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Target Return</div>
              <div className="text-lg font-semibold text-accent" data-testid="text-calculated-target-return">
                {calculations.calculatedTargetReturn.toFixed(1)}%
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm text-muted-foreground">Annualized Return</div>
              <div className="text-lg font-semibold text-accent" data-testid="text-annualized-return">
                ~{calculations.annualizedReturn.toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projected Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <i className="fas fa-table text-accent mr-3"></i>
            Projected Returns & Cash Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground">Year</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Shares Issued</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Div Allocation</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Div Return</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Growth %</th>
                  <th className="text-right py-3 px-2 font-medium text-muted-foreground">Investment Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-3 px-2 font-medium">Year 0</td>
                  <td className="text-right py-3 px-2">-</td>
                  <td className="text-right py-3 px-2">-</td>
                  <td className="text-right py-3 px-2">-</td>
                  <td className="text-right py-3 px-2">-</td>
                  <td className="text-right py-3 px-2 font-semibold" data-testid="text-year0-value">
                    R {(formData.investmentAmount || 0).toLocaleString()}
                  </td>
                </tr>
                <tr className="border-b border-border hover:bg-muted transition-colors">
                  <td className="py-3 px-2 font-medium">Year 1</td>
                  <td className="text-right py-3 px-2" data-testid="text-year1-shares">
                    {Math.floor(calculations.sharesIssued).toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-2" data-testid="text-year1-allocation">
                    {(formData.year1Dividend || 0).toFixed(3)}
                  </td>
                  <td className="text-right py-3 px-2 text-accent font-medium" data-testid="text-year1-return">
                    R {calculations.year1Return.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-2 text-accent" data-testid="text-year1-growth">
                    {calculations.year1Growth.toFixed(2)}%
                  </td>
                  <td className="text-right py-3 px-2 font-semibold" data-testid="text-year1-value">
                    R {calculations.year1Value.toLocaleString()}
                  </td>
                </tr>
                <tr className="border-b border-border hover:bg-muted transition-colors">
                  <td className="py-3 px-2 font-medium">Year 2</td>
                  <td className="text-right py-3 px-2" data-testid="text-year2-shares">
                    {Math.floor(calculations.sharesIssued).toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-2" data-testid="text-year2-allocation">
                    {(formData.year2Dividend || 0).toFixed(3)}
                  </td>
                  <td className="text-right py-3 px-2 text-accent font-medium" data-testid="text-year2-return">
                    R {calculations.year2Return.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-2 text-accent" data-testid="text-year2-growth">
                    {calculations.year2Growth.toFixed(2)}%
                  </td>
                  <td className="text-right py-3 px-2 font-semibold" data-testid="text-year2-value">
                    R {calculations.year2Value.toLocaleString()}
                  </td>
                </tr>
                <tr className="hover:bg-muted transition-colors">
                  <td className="py-3 px-2 font-medium">Year 3</td>
                  <td className="text-right py-3 px-2" data-testid="text-year3-shares">
                    {Math.floor(calculations.sharesIssued).toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-2" data-testid="text-year3-allocation">
                    {(formData.year3Dividend || 0).toFixed(3)}
                  </td>
                  <td className="text-right py-3 px-2 text-accent font-medium" data-testid="text-year3-return">
                    R {calculations.year3Return.toLocaleString()}
                  </td>
                  <td className="text-right py-3 px-2 text-accent" data-testid="text-year3-growth">
                    {calculations.year3Growth.toFixed(2)}%
                  </td>
                  <td className="text-right py-3 px-2 font-semibold" data-testid="text-year3-value">
                    R {calculations.year3Value.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Alert>
            <i className="fas fa-exclamation-triangle text-accent mt-0.5"></i>
            <AlertDescription>
              <p className="font-medium mb-1">Important Notes:</p>
              <ul className="space-y-1 text-xs">
                <li>• Returns are based on historical PE performance; actual results may vary</li>
                <li>• Fund value is non-liquid during the investment period</li>
                <li>• Investment is locked for the full term with no early access</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last generated:</span>
              <span className="font-medium" data-testid="text-last-generated">{lastGenerated}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
