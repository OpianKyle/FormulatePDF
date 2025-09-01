import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProposalSchema, type ProposalForm } from "@shared/schema";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all proposals
  app.get("/api/proposals", async (_req, res) => {
    try {
      const proposals = await storage.getAllProposals();
      res.json(proposals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  // Create new proposal
  app.post("/api/proposals", async (req, res) => {
    try {
      const validatedData = insertProposalSchema.parse(req.body);
      const proposal = await storage.createProposal(validatedData);
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ error: "Invalid proposal data" });
    }
  });

  // Generate PDF from proposal
  app.post("/api/proposals/:id/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      const proposal = await storage.getProposal(id);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      
      // Calculate investment projections
      const sharesIssued = proposal.investmentAmount / 8; // Assuming R8 per share
      const year1Return = sharesIssued * proposal.year1Dividend;
      const year2Return = sharesIssued * proposal.year2Dividend;
      const year3Return = sharesIssued * proposal.year3Dividend;
      
      const year1Value = proposal.investmentAmount + year1Return;
      const year2Value = year1Value + year2Return;
      const year3Value = year2Value + year3Return;

      const year1Growth = (year1Return / proposal.investmentAmount) * 100;
      const year2Growth = (year2Return / year1Value) * 100;
      const year3Growth = (year3Return / year2Value) * 100;

      const targetValue = proposal.investmentAmount * (1 + proposal.targetReturn / 100);
      const totalProfit = targetValue - proposal.investmentAmount;
      const annualizedReturn = Math.pow(targetValue / proposal.investmentAmount, 1 / proposal.timeHorizon) - 1;

      // Load and embed the cover page image
      let coverImage;
      try {
        const imagePath = path.join(__dirname, '../attached_assets/image_1756730534595.png');
        const imageBytes = await fs.readFile(imagePath);
        coverImage = await pdfDoc.embedPng(imageBytes);
      } catch (error) {
        console.warn('Could not load cover image, using text-only cover page');
      }

      // Load and embed the logo for content pages
      let logoImage;
      try {
        const logoPath = path.join(__dirname, '../attached_assets/image_1756732571502.png');
        const logoBytes = await fs.readFile(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (error) {
        console.warn('Could not load logo image');
      }

      // Load and embed the signature image
      let signatureImage;
      try {
        const signaturePath = path.join(__dirname, '../attached_assets/image_1756732618787.png');
        const signatureBytes = await fs.readFile(signaturePath);
        signatureImage = await pdfDoc.embedPng(signatureBytes);
      } catch (error) {
        console.warn('Could not load signature image');
      }

      // Create cover page
      const coverPage = pdfDoc.addPage([595.28, 841.89]); // A4 size
      
      if (coverImage) {
        // Scale image to fit the page while maintaining aspect ratio
        const { width, height } = coverImage.scale(1);
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        
        // Calculate scale to fit page
        const scaleX = pageWidth / width;
        const scaleY = pageHeight / height;
        const scale = Math.min(scaleX, scaleY);
        
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        
        // Center the image on the page
        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;
        
        coverPage.drawImage(coverImage, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });
      } else {
        // Fallback text-only cover page
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        coverPage.drawText("OPIAN CAPITAL", {
          x: 200,
          y: 600,
          size: 24,
          font: boldFont,
          color: rgb(0.8, 0.7, 0.2), // Gold color
        });
        
        coverPage.drawText("PRIVATE EQUITY PROPOSAL", {
          x: 150,
          y: 400,
          size: 20,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      }

      // Embed fonts for content pages
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Function to add logo to page
      const addLogoToPage = (page: any) => {
        if (logoImage) {
          const logoWidth = 180; // Much bigger logo
          const logoHeight = 60;
          const pageWidth = 595.28;
          const x = pageWidth - logoWidth - 20; // 20px margin from right edge
          const y = 780; // More reasonable top margin (was 800, too close to edge)
          
          page.drawImage(logoImage, {
            x: x,
            y: y,
            width: logoWidth,
            height: logoHeight,
          });
        }
      };

      // PAGE 1 - First content page
      const page1 = pdfDoc.addPage([595.28, 841.89]); // A4 size
      addLogoToPage(page1);
      let yPos = 720; // Lower starting position with proper spacing from logo
      
      // Full page width margins - minimal side margins
      const leftMargin = 20;
      const rightMargin = 20;
      const contentWidth = 595.28 - leftMargin - rightMargin; // 555.28 - much wider

      // Dynamic title with investment details - full width
      const titleText = `Turning R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} (${proposal.targetReturn}% Growth) in ${proposal.timeHorizon} Years`;
      page1.drawText(titleText, {
        x: leftMargin,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 60; // More space

      // Client information with better spacing
      page1.drawText(`Prepared for: ${proposal.clientName}`, {
        x: leftMargin,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 40; // Much more space between sections
      
      // Word wrap function definition
      const wrapText = (text: string, maxWidth: number) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          if (testLine.length * 6 > maxWidth) { // Rough character width estimation
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              lines.push(word);
            }
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
      };

      // Address with word wrapping support for long addresses
      page1.drawText("Address:", {
        x: leftMargin,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      
      yPos -= 20;
      const addressLines = wrapText(proposal.clientAddress, contentWidth - 100);
      addressLines.forEach((line) => {
        page1.drawText(line, {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 12; // Reduced line spacing for address
      });

      yPos -= 30; // More space after address to prevent date overlap
      
      page1.drawText(`Date: ${proposal.proposalDate}`, {
        x: leftMargin,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 50; // Large space before Dear section
      
      // Dear section as prominent heading
      page1.drawText(`Dear ${proposal.clientName}`, {
        x: leftMargin,
        y: yPos,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });


      yPos -= 30; // Reduced space after 'Dear {Name}'
      page1.drawText("We thank you for your interest in our Private Equity Proposal", {
        x: leftMargin,
        y: yPos,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 30;
      page1.drawText("1. Executive Summary", {
        x: leftMargin,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      // Executive summary with dynamic values
      const executiveSummary = `This proposal outlines a strategic private equity (PE) investment strategy designed to grow an initial capital of R${proposal.investmentAmount.toLocaleString()} by ${proposal.targetReturn}% (R${targetValue.toLocaleString()} total) over a ${proposal.timeHorizon}-year horizon. By leveraging high-growth private equity opportunities in carefully selected industries, we aim to maximize returns while mitigating risks through diversification and expert fund management.`;
      
      // Word wrap for executive summary

      // Function to sanitize text and remove Unicode characters that can't be encoded
      const sanitizeText = (text: string) => {
        return text
          .replace(/➤/g, '•')
          .replace(/🔘/g, '•')
          .replace(/☑/g, '•')
          .replace(/✓/g, '•')
          .replace(/📞/g, 'Tel:')
          .replace(/✉/g, 'Email:')
          .replace(/🌐/g, 'Website:')
          .replace(/[^\x00-\x7F]/g, ''); // Remove any remaining non-ASCII characters
      };

      const summaryLines = wrapText(executiveSummary, contentWidth - 40); // Full width content
      summaryLines.forEach((line) => {
        page1.drawText(sanitizeText(line), {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 14;
      });

      yPos -= 15;
      page1.drawText("Key Highlights:", {
        x: leftMargin,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      const highlights = [
        `• Target Return: ${proposal.targetReturn}% growth (R${totalProfit.toLocaleString()} profit) in ${proposal.timeHorizon} years (~${(annualizedReturn * 100).toFixed(1)}% annualised return).`,
        "• Investment Strategy: Focus on growth equity in high-potential sectors.",
        "• Risk Management: Portfolio diversification, and active management.",
        `• Exit Strategy: Share buybacks, IPOs, or secondary buyouts after ${proposal.timeHorizon} years.`
      ];

      highlights.forEach((highlight) => {
        const highlightLines = wrapText(highlight, contentWidth - 60); // Full width with bullet indent
        highlightLines.forEach((line) => {
          page1.drawText(sanitizeText(line), {
            x: leftMargin + 20, // Indent for bullet points
            y: yPos,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
          yPos -= 14;
        });
        yPos -= 5;
      });

      // Continue on page 1 with Investment Opportunity section
      yPos -= 25;
      page1.drawText("2. Investment Opportunity & Market Outlook", {
        x: leftMargin,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      const marketText = "Private equity has historically outperformed public markets, delivering 12-25%+ annual returns in emerging markets like South Africa and BRICS. Key sectors with strong growth potential include:";
      const marketLines = wrapText(marketText, contentWidth - 40); // Full width
      marketLines.forEach((line) => {
        page1.drawText(line, {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 14;
      });

      yPos -= 8;
      const sectors = [
        "Technology & FinTech (Digital payments, SaaS, AI Related business)",
        "Consumer Goods & Retail (E-commerce, premium brands, Rewards, Lifestyle products)",
        "Healthcare & Biotechnology (Telemedicine, generics manufacturing)"
      ];

      sectors.forEach((sector) => {
        page1.drawText(sector, {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 14;
      });

      yPos -= 10;
      const renewableText = "Renewable Energy (Solar, battery storage)";
      page1.drawText(renewableText, {
        x: leftMargin,
        y: yPos,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 18;
      const investText = "By investing in early stage but undervalued businesses with strong cash flow, IP and scalability, we position the portfolio for accelerated growth.";
      const investLines = wrapText(investText, contentWidth - 40); // Full width
      investLines.forEach((line) => {
        page1.drawText(line, {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 14;
      });

      // PAGE 2 - Second content page
      const page2 = pdfDoc.addPage([595.28, 841.89]);
      addLogoToPage(page2);
      yPos = 720; // Lower starting position to accommodate bigger logo

      // Investment Structure section
      page2.drawText("3. Proposed Investment Structure", {
        x: leftMargin,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 25;

      // Investment Structure Table
      const tableData = [
        ["Component", "Details"],
        ["Investment Amount", `R${proposal.investmentAmount.toLocaleString()},00`],
        ["Target Return", `R${targetValue.toLocaleString()},00 (${proposal.targetReturn}% growth)`],
        ["Time Horizon", `${proposal.timeHorizon} years`],
        ["Annualised Return", `~${(annualizedReturn * 100).toFixed(0)}%`],
        ["Investment Vehicle", "Private Equity / Direct Investment"],
        ["Key Sectors", "FinTech, Lifestyle, Online Education"]
      ];

      // Draw table borders
      const tableStartY = yPos;
      const rowHeight = 18;
      const col1Width = 120;
      const col2Width = 300;

      // Table border
      page2.drawRectangle({
        x: 56,
        y: tableStartY - (rowHeight * tableData.length),
        width: col1Width + col2Width,
        height: rowHeight * tableData.length,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      // Column divider
      page2.drawLine({
        start: { x: 56 + col1Width, y: tableStartY },
        end: { x: 56 + col1Width, y: tableStartY - (rowHeight * tableData.length) },
        color: rgb(0, 0, 0),
        thickness: 1,
      });

      // Row dividers and content
      tableData.forEach((row, index) => {
        const isHeader = index === 0;
        const currentY = tableStartY - (index * rowHeight) - 12;
        
        // Row divider (except for last row)
        if (index < tableData.length - 1) {
          page2.drawLine({
            start: { x: 56, y: tableStartY - ((index + 1) * rowHeight) },
            end: { x: 56 + col1Width + col2Width, y: tableStartY - ((index + 1) * rowHeight) },
            color: rgb(0, 0, 0),
            thickness: 1,
          });
        }

        // Content
        page2.drawText(row[0], {
          x: 61,
          y: currentY,
          size: 9,
          font: isHeader ? boldFont : font,
          color: rgb(0, 0, 0),
        });
        
        page2.drawText(row[1], {
          x: 61 + col1Width,
          y: currentY,
          size: 9,
          font: isHeader ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      });

      yPos = tableStartY - (rowHeight * tableData.length) - 30;

      // Why Private Equity section
      page2.drawText("Why Private Equity?", {
        x: 56,
        y: yPos,
        size: 10,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 15;
      const peReasons = [
        "• Higher Returns: PE typically outperforms stocks & bonds.",
        "• Active Value Creation: Hands-on management improves business performance.",
        "• Lower Volatility: Unlike public markets, PE is less exposed to short-term fluctuations."
      ];

      peReasons.forEach((reason) => {
        page2.drawText(reason, {
          x: 66,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      });

      yPos -= 20;

      // Projected Returns & Cash Flow
      page2.drawText("4. Projected Returns & Cash Flow", {
        x: 56,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 25;

      // Cash Flow Table
      const cashFlowData = [
        ["Year", "Shares Issued", "Div Allocation", "Div Return", "Growth (%)", "Investment Value"],
        ["Year 0", "-", "-", "-", "-", `R${proposal.investmentAmount.toLocaleString()},00`],
        ["Year 1", Math.floor(sharesIssued).toLocaleString(), proposal.year1Dividend.toFixed(3), `R${year1Return.toLocaleString()},00`, `${year1Growth.toFixed(2)}%`, `R${year1Value.toLocaleString()},00`],
        ["Year 2", Math.floor(sharesIssued).toLocaleString(), proposal.year2Dividend.toFixed(3), `R${year2Return.toLocaleString()},00`, `${year2Growth.toFixed(2)}%`, `R${year2Value.toLocaleString()},00`],
        ["Year 3", Math.floor(sharesIssued).toLocaleString(), proposal.year3Dividend.toFixed(3), `R${year3Return.toLocaleString()},00`, `${year3Growth.toFixed(2)}%`, `R${year3Value.toLocaleString()},00`]
      ];

      // Cash flow table positions
      const colWidths = [40, 75, 75, 75, 60, 95];
      const colPositions = [56];
      for (let i = 1; i < colWidths.length; i++) {
        colPositions.push(colPositions[i-1] + colWidths[i-1]);
      }

      const tableHeight = cashFlowData.length * 18;
      const tableTop = yPos;

      // Table border
      page2.drawRectangle({
        x: 56,
        y: tableTop - tableHeight,
        width: colWidths.reduce((a, b) => a + b, 0),
        height: tableHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      // Column dividers
      for (let i = 1; i < colPositions.length; i++) {
        page2.drawLine({
          start: { x: colPositions[i], y: tableTop },
          end: { x: colPositions[i], y: tableTop - tableHeight },
          color: rgb(0, 0, 0),
          thickness: 1,
        });
      }

      // Row data
      cashFlowData.forEach((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        const currentY = tableTop - (rowIndex * 18) - 12;
        
        // Row divider
        if (rowIndex < cashFlowData.length - 1) {
          page2.drawLine({
            start: { x: 56, y: tableTop - ((rowIndex + 1) * 18) },
            end: { x: 56 + colWidths.reduce((a, b) => a + b, 0), y: tableTop - ((rowIndex + 1) * 18) },
            color: rgb(0, 0, 0),
            thickness: 1,
          });
        }

        // Cell content
        row.forEach((cell, colIndex) => {
          page2.drawText(cell, {
            x: colPositions[colIndex] + 3,
            y: currentY,
            size: 8,
            font: isHeader ? boldFont : font,
            color: rgb(0, 0, 0),
          });
        });
      });

      yPos = tableTop - tableHeight - 20;

      // Notes
      const notes = [
        "• Note: While returns are based on historical PE performance; actual results may vary.",
        "• Fund Value is non liquid",
        "• The investment is locked into the period with no access to investment"
      ];

      notes.forEach((note) => {
        page2.drawText(note, {
          x: 66,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 12;
      });

      // PAGE 3 - Third content page
      const page3 = pdfDoc.addPage([595.28, 841.89]);
      addLogoToPage(page3);
      yPos = 720; // Lower starting position to accommodate bigger logo

      // Risk Mitigation Strategy
      page3.drawText("5. Risk Mitigation Strategy", {
        x: leftMargin,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 15;
      page3.drawText("To safeguard capital while pursuing high returns, we implement:", {
        x: 56,
        y: yPos,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      const riskStrategies = [
        "• Diversification across 1-5 high-growth potential companies",
        "• Due Diligence on management teams, financials, and market trends",
        "• Structured Exit Plans (Share swops, IPO, recapitalization, buyouts)",
        "• Co-Investment Model (Reduces exposure via partnerships)"
      ];

      riskStrategies.forEach((strategy) => {
        page3.drawText(strategy, {
          x: 66,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      });

      yPos -= 15;

      // Why Invest With Us section
      page3.drawText("6. Why Invest With Us?", {
        x: 56,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 15;
      const whyInvestItems = [
        "• Industry Expertise: Deep knowledge of South African & African markets",
        "• Transparent Fees: Performance-based compensation (2% management fee + 20% carry)",
        "• Aligned Interests: We invest alongside clients",
        "• Ownership: We take a large ownership and management stake in companies we invest in"
      ];

      whyInvestItems.forEach((item) => {
        page3.drawText(item, {
          x: 66,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      });

      yPos -= 20;

      // Next Steps
      page3.drawText("7. Next Steps", {
        x: 56,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 15;
      const nextSteps = [
        "1. Decision Taking: Deciding on risk appetite & capital to be invested",
        "2. Risk Process: Making investment and completing documentation",
        "3. Capital Deployment: We begin investment within 2-6 weeks post due diligence.",
        "4. Quarterly Reporting: Transparent updates on performance."
      ];

      nextSteps.forEach((step) => {
        page3.drawText(step, {
          x: 66,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      });

      yPos -= 20;

      // Conclusion
      page3.drawText("8. Conclusion", {
        x: 56,
        y: yPos,
        size: 11,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 15;
      // Ensure we don't go too low to avoid footer overlap
      if (yPos < 80) yPos = 80; // Ensure content stays above footer
      const conclusionText = `This private equity strategy offers a compelling opportunity to grow R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} in ${proposal.timeHorizon} years (${proposal.targetReturn}% return) by leveraging high-growth, private-held businesses. With disciplined risk management and sector expertise, we are confident in delivering superior returns.`;
      const conclusionLines = wrapText(conclusionText, 480);
      conclusionLines.forEach((line) => {
        if (yPos > 70) { // Only draw if there's room above footer (footer at y=20+30=50)
          page3.drawText(line, {
            x: 56,
            y: yPos,
            size: 9,
            font,
            color: rgb(0, 0, 0),
          });
          yPos -= 12;
        }
      });

      yPos -= 15;
      // Ensure we don't go too low before thank you section
      if (yPos < 80) yPos = 80; // Ensure content stays above footer
      const thankYouText = "Thank you for your consideration. Please reach out to me if there are further concerns or let's discuss how we can tailor this strategy to your goals.";
      const thankYouLines = wrapText(thankYouText, 480);
      thankYouLines.forEach((line) => {
        if (yPos > 70) { // Only draw if there's room above footer (footer at y=20+30=50)
          page3.drawText(line, {
            x: 56,
            y: yPos,
            size: 9,
            font,
            color: rgb(0, 0, 0),
          });
          yPos -= 12;
        }
      });

      yPos -= 20;

      // Kind Regards - only draw if there's room
      if (yPos > 70) {
        page3.drawText("Kind Regards", {
          x: 56,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }

      yPos -= 20;

      // Add signature image - only if there's room above footer
      if (signatureImage && yPos > 130) {
        const signatureWidth = 120;
        const signatureHeight = 60;
        
        page3.drawImage(signatureImage, {
          x: 56,
          y: yPos - signatureHeight,
          width: signatureWidth,
          height: signatureHeight,
        });
        
        yPos -= signatureHeight + 10;
      } else if (yPos > 90) {
        yPos -= 40; // Space for signature if image fails to load
      }

      // CEO signature - only draw if there's room
      if (yPos > 70) {
        page3.drawText("Lance E Heynes", {
          x: 56,
          y: yPos,
          size: 10,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      }

      // CEO title - only draw if there's room
      yPos -= 15;
      if (yPos > 70) {
        page3.drawText("CEO", {
          x: 56,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }

      yPos -= 30;

      // Contact information - only draw if there's room
      if (yPos > 70) {
        page3.drawText("Tel: 081 323 4297", {
          x: 56,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      }
      
      if (yPos > 70) {
        page3.drawText("Email: lance@opianfsgroup.com", {
          x: 56,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      }
      
      if (yPos > 70) {
        page3.drawText("Website: www.opiancapital.com", {
          x: 56,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
      }

      yPos -= 30;

      // Disclaimer
      const disclaimerText = "*Disclaimer: This proposal is for illustrative purposes only. Past performance is not indicative of future results. Private equity involves risk, including potential loss of capital. Investors should conduct independent due diligence before making investment decisions.*";
      const disclaimerLines = wrapText(disclaimerText, 480);
      disclaimerLines.forEach((line) => {
        page3.drawText(line, {
          x: 56,
          y: yPos,
          size: 8,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPos -= 10;
      });

      // Footer on all content pages
      const footerY = 20; // Footer positioned 20px from bottom as requested
      const footerText = "Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974\nCompany Registration Number: 2022/272376/07 FSP No: 50974\nCompany Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape\nTel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com";
      
      [page1, page2, page3].forEach((page) => {
        page.drawText("Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974", {
          x: 165,
          y: footerY + 30,
          size: 7,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        
        page.drawText("Company Registration Number: 2022/272376/07 FSP No: 50974", {
          x: 165,
          y: footerY + 20,
          size: 7,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        
        page.drawText("Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape", {
          x: 165,
          y: footerY + 10,
          size: 7,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        
        page.drawText("Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com", {
          x: 165,
          y: footerY,
          size: 7,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
      });

      const pdfBytes = await pdfDoc.save();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.clientName.replace(/\s+/g, '-')}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF", details: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
