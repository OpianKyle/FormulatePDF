import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProposalSchema } from "@shared/schema";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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

      // === PDF Setup ===
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const leftMargin = 72; // 1 inch margin
      const rightMargin = 72;
      const pageWidth = 595.28;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      // Load logo image
      let logoImage: any = null;
      try {
        const logoPath = path.join(__dirname, "../attached_assets/image_1756974781134.png");
        const logoBytes = await fs.readFile(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (error) {
        console.warn("Could not load logo image:", error);
      }

      // === Helper Functions ===
      const drawJustifiedText = (
        page: any,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        font: any,
        fontSize: number = 10,
        lineSpacing: number = 17 // 1.5 line spacing
      ) => {
        text = text.replace(/\s+/g, " ").trim();
        const words = text.split(" ");
        let lines: string[][] = [];
        let currentLine: string[] = [];

        words.forEach((word) => {
          const testLine = [...currentLine, word];
          const textWidth = font.widthOfTextAtSize(testLine.join(" "), fontSize);
          if (textWidth > maxWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = [word];
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine.length > 0) lines.push(currentLine);

        lines.forEach((lineWords, i) => {
          const lineText = lineWords.join(" ");
          const lineWidth = font.widthOfTextAtSize(lineText, fontSize);

          if (i === lines.length - 1 || lineWords.length === 1) {
            // Last line or single word - left align
            page.drawText(lineText, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
          } else {
            // Justify text by distributing extra space
            const extraSpace = (maxWidth - lineWidth) / (lineWords.length - 1);
            let cursorX = x;
            lineWords.forEach((word, wordIndex) => {
              page.drawText(word, { x: cursorX, y, size: fontSize, font, color: rgb(0, 0, 0) });
              if (wordIndex < lineWords.length - 1) {
                cursorX += font.widthOfTextAtSize(word, fontSize) + font.widthOfTextAtSize(" ", fontSize) + extraSpace;
              }
            });
          }
          y -= lineSpacing;
        });

        return y;
      };

      const addFooter = (page: any) => {
        const footerY = 50;
        const footerText = [
          "Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974",
          "Company Registration Number: 2022/272376/07 FSP No: 50974", 
          "Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape",
          "Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com"
        ];
        
        footerText.forEach((line, i) => {
          page.drawText(line, { 
            x: leftMargin, 
            y: footerY + (footerText.length - 1 - i) * 10, 
            size: 8, 
            font, 
            color: rgb(0, 0, 0) 
          });
        });
      };

      const addLogo = (page: any) => {
        if (logoImage) {
          const logoWidth = 170;
          const logoHeight = 50;
          const x = pageWidth - logoWidth - 25;
          const y = 780;
          
          page.drawImage(logoImage, {
            x,
            y,
            width: logoWidth,
            height: logoHeight
          });
        }
      };

      // === Calculations ===
      const targetValue = proposal.investmentAmount * (1 + proposal.targetReturn / 100);
      const sharesIssued = proposal.investmentAmount / 8;
      const year1Return = sharesIssued * proposal.year1Dividend;
      const year2Return = sharesIssued * proposal.year2Dividend;
      const year3Return = sharesIssued * proposal.year3Dividend;
      const year1Value = proposal.investmentAmount + year1Return;
      const year2Value = year1Value + year2Return;
      const year3Value = year2Value + year3Return;
      const annualizedReturn = Math.pow(targetValue / proposal.investmentAmount, 1 / proposal.timeHorizon) - 1;

      // === COVER PAGE ===
      const coverPage = pdfDoc.addPage([595.28, 841.89]);
      let yPos = 780;

      // Cover page header - top left
      coverPage.drawText("OFFER LETTER", { 
        x: leftMargin, 
        y: yPos, 
        size: 14, 
        font: boldFont 
      });

      yPos -= 300; // Large spacing to center content

      // Center the main title
      const mainTitle = "PRIVATE EQUITY PROPOSAL";
      const titleWidth = boldFont.widthOfTextAtSize(mainTitle, 24);
      const titleX = (pageWidth - titleWidth) / 2;
      coverPage.drawText(mainTitle, { 
        x: titleX, 
        y: yPos, 
        size: 24, 
        font: boldFont 
      });

      yPos -= 80;

      // Subtitle - centered
      const subtitle = "Private Equity Proposal – CAPITAL GROWTH";
      const subtitleWidth = font.widthOfTextAtSize(subtitle, 16);
      const subtitleX = (pageWidth - subtitleWidth) / 2;
      coverPage.drawText(subtitle, { 
        x: subtitleX, 
        y: yPos, 
        size: 16, 
        font: boldFont 
      });

      // === PAGE 1: MAIN CONTENT ===
      const page1 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page1);
      addLogo(page1);
      yPos = 750;

      // Title with dynamic values
      const pageTitle = `Turning R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} (${proposal.targetReturn}% Growth) in ${proposal.timeHorizon} Years`;
      page1.drawText(pageTitle, { 
        x: leftMargin, 
        y: yPos, 
        size: 14, 
        font: boldFont 
      });

      yPos -= 40;

      // Client information
      page1.drawText("Prepared for:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 25;
      page1.drawText(proposal.clientName, { x: leftMargin, y: yPos, size: 11, font });
      yPos -= 40;

      page1.drawText("Address:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 25;
      const addressLines = proposal.clientAddress.split("\\n");
      addressLines.forEach(line => {
        if (line.trim()) {
          page1.drawText(line, { x: leftMargin, y: yPos, size: 11, font });
          yPos -= 20;
        }
      });

      yPos -= 40; // Extra spacing before date
      page1.drawText(`Date: ${proposal.proposalDate}`, { x: leftMargin, y: yPos, size: 11, font });

      yPos -= 40;
      page1.drawText(`Dear ${proposal.clientName}`, { x: leftMargin, y: yPos, size: 11, font });

      yPos -= 30;
      page1.drawText("We thank you for your interest in our Private Equity Proposal", { 
        x: leftMargin, 
        y: yPos, 
        size: 11, 
        font 
      });

      yPos -= 40;

      // Executive Summary
      page1.drawText("Executive Summary", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const executiveSummary = `This proposal outlines a strategic private equity (PE) investment strategy designed to grow an initial capital of R${proposal.investmentAmount.toLocaleString()} by ${proposal.targetReturn}% (R${targetValue.toLocaleString()} total) over a ${proposal.timeHorizon}-year horizon. By leveraging high-growth private equity opportunities in carefully selected industries, we aim to maximize returns while mitigating risks through diversification and expert fund management.`;
      yPos = drawJustifiedText(page1, executiveSummary, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 25;

      // Key Highlights
      page1.drawText("Key Highlights:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;

      const highlights = [
        `• Target Return: ${proposal.targetReturn}% growth (R${(targetValue - proposal.investmentAmount).toLocaleString()} profit) in ${proposal.timeHorizon} years (~${(annualizedReturn * 100).toFixed(0)}% annualized return).`,
        "• Investment Strategy: Focus on growth equity in high-potential sectors.",
        "• Risk Management: Portfolio diversification, and active management.",
        `• Exit Strategy: Share buybacks, IPOs, or secondary buyouts after ${proposal.timeHorizon} years.`
      ];

      highlights.forEach(highlight => {
        yPos = drawJustifiedText(page1, highlight, leftMargin, yPos, contentWidth, font, 11);
        yPos -= 10;
      });

      // === PAGE 2: INVESTMENT OPPORTUNITY ===
      const page2 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page2);
      addLogo(page2);
      yPos = 750;

      // Investment Opportunity & Market Outlook
      page2.drawText("Investment Opportunity & Market Outlook", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 25;

      const marketText = "Private equity has historically outperformed public markets, delivering 12-25%+ annual returns in emerging markets like South Africa and BRICS. Key sectors with strong growth potential include:";
      yPos = drawJustifiedText(page2, marketText, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 20;

      const sectors = [
        "Technology & FinTech (Digital payments, SaaS, AI Related business)",
        "Consumer Goods & Retail (E-commerce, premium brands, Rewards, Lifestyle products)",
        "Healthcare & Pharma (Telemedicine, generics manufacturing)",
        "Renewable Energy (Solar, battery storage)"
      ];

      sectors.forEach(sector => {
        page2.drawText(sector, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 17;
      });

      yPos -= 20;

      const investText = "By investing in early stage but undervalued businesses with strong cash flow, IP and scalability, we position the portfolio for accelerated growth.";
      yPos = drawJustifiedText(page2, investText, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 40;

      // Proposed Investment Structure
      page2.drawText("Proposed Investment Structure", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 30;

      // Investment Structure Table
      const tableData = [
        ["Component", "Details"],
        ["Investment Amount", `R${proposal.investmentAmount.toLocaleString()}, 00`],
        ["Target Return", `R${targetValue.toLocaleString()}, 00 (${proposal.targetReturn}% growth)`],
        ["Time Horizon", `${proposal.timeHorizon} years`],
        ["Annualised Return", `~${(annualizedReturn * 100).toFixed(0)}%`],
        ["Investment Vehicle", "Private Equity / Direct Investment"],
        ["Key Sectors", "FinTech, Lifestyle, Online Education"]
      ];

      const col1Width = 180;
      const col2Width = contentWidth - col1Width;
      const rowHeight = 25;
      let tableStartY = yPos;

      // Draw table with borders
      tableData.forEach((row, rowIndex) => {
        const currentY = tableStartY - (rowIndex * rowHeight);
        const isHeader = rowIndex === 0;
        
        // Draw cell borders
        page2.drawRectangle({
          x: leftMargin,
          y: currentY - rowHeight,
          width: col1Width,
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1
        });
        
        page2.drawRectangle({
          x: leftMargin + col1Width,
          y: currentY - rowHeight,
          width: col2Width,
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1
        });

        // Draw text
        page2.drawText(row[0], {
          x: leftMargin + 8,
          y: currentY - 15,
          size: 10,
          font: isHeader ? boldFont : font
        });
        
        page2.drawText(row[1], {
          x: leftMargin + col1Width + 8,
          y: currentY - 15,
          size: 10,
          font: isHeader ? boldFont : font
        });
      });

      yPos = tableStartY - (tableData.length * rowHeight) - 30;

      // === PAGE 3: WHY PRIVATE EQUITY ===
      const page3 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page3);
      addLogo(page3);
      yPos = 750;

      // Why Private Equity section
      page3.drawText("Why Private Equity?", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const whyPEReasons = [
        "• Higher Returns: PE typically outperforms stocks & bonds.",
        "• Active Value Creation: Hands-on management improves business performance.",
        "• Lower Volatility: Unlike public markets, PE is less exposed to short-term fluctuations."
      ];

      whyPEReasons.forEach(reason => {
        page3.drawText(reason, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 20;
      });

      // === PAGE 4: PROJECTED RETURNS ===
      const page4 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page4);
      addLogo(page4);
      yPos = 750;

      // Projected Returns & Cash Flow
      page4.drawText("Projected Returns & Cash Flow", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 30;

      // Cash Flow Table
      const cashFlowData = [
        ["Year", "Shares Issued", "Div Allocation", "Div Return", "Growth (%)", "Investment Value"],
        ["Year 0", "-", "-", "-", "-", `R${proposal.investmentAmount.toLocaleString()}, 00`],
        ["Year 1", Math.floor(sharesIssued).toLocaleString(), proposal.year1Dividend.toFixed(3), `R${year1Return.toLocaleString()}, 00`, `${((year1Return / proposal.investmentAmount) * 100).toFixed(2)}%`, `R${year1Value.toLocaleString()}, 00`],
        ["Year 2", Math.floor(sharesIssued).toLocaleString(), proposal.year2Dividend.toFixed(3), `R${year2Return.toLocaleString()}, 00`, `${((year2Return / year1Value) * 100).toFixed(2)}%`, `R${year2Value.toLocaleString()}, 00`],
        ["Year 3", Math.floor(sharesIssued).toLocaleString(), proposal.year3Dividend.toFixed(3), `R${year3Return.toLocaleString()}, 00`, `${((year3Return / year2Value) * 100).toFixed(2)}%`, `R${year3Value.toLocaleString()}, 00`]
      ];

      const colWidths = [60, 85, 85, 85, 70, 100];
      let tableTop = yPos;

      // Draw cash flow table
      cashFlowData.forEach((row, rowIndex) => {
        const currentY = tableTop - (rowIndex * 25);
        const isHeader = rowIndex === 0;
        
        let xPos = leftMargin;
        row.forEach((cell, colIndex) => {
          // Draw cell border
          page4.drawRectangle({
            x: xPos,
            y: currentY - 25,
            width: colWidths[colIndex],
            height: 25,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1
          });
          
          // Draw text
          page4.drawText(cell, {
            x: xPos + 4,
            y: currentY - 15,
            size: 9,
            font: isHeader ? boldFont : font
          });
          
          xPos += colWidths[colIndex];
        });
      });

      yPos = tableTop - (cashFlowData.length * 25) - 25;

      // Notes
      const notes = [
        "• Note: While returns are based on historical PE performance; actual results may vary.",
        "• Fund Value is non liquid",
        "• The investment is locked into the period with no access to investment"
      ];

      notes.forEach(note => {
        page4.drawText(note, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 20;
      });

      yPos -= 40;

      // Risk Mitigation Strategy
      page4.drawText("Risk Mitigation Strategy", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 30;

      const riskIntro = "To safeguard capital while pursuing high returns, we implement:";
      yPos = drawJustifiedText(page4, riskIntro, leftMargin, yPos, contentWidth, font, 11);
      yPos -= 25;

      const riskStrategies = [
        "• Diversification across 1-5 high-growth potential companies",
        "• Due Diligence on management teams, financials, and market trends",
        "• Structured Exit Plans (Share swops, IPO, recapitalization, buyouts)",
        "• Co-Investment Model (Reduces exposure via partnerships)"
      ];

      riskStrategies.forEach(strategy => {
        page4.drawText(strategy, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 20;
      });

      yPos -= 30;

      // Why Invest With Us
      page4.drawText("Why Invest With Us?", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 30;

      const whyUsPoints = [
        "• Industry Expertise: Deep knowledge of South African & African markets",
        "• Transparent Fees: Performance-based compensation (2% management fee + 20% carry)",
        "• Aligned Interests: We invest alongside clients",
        "• Ownership: We take ownership and management stake in companies we invest in"
      ];

      whyUsPoints.forEach(point => {
        page4.drawText(point, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 20;
      });

      // === PAGE 5: NEXT STEPS ===
      const page5 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page5);
      addLogo(page5);
      yPos = 750;

      // Next Steps
      page5.drawText("Next Steps", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 30;

      const nextSteps = [
        "1. Decision Taking: Deciding on risk appetite & capital to be invested",
        "2. FAIS Process: Making investment and completing documentation", 
        "3. Capital Deployment: We begin investment within 2-6 weeks post due diligence.",
        "4. Quarterly Reporting: Transparent updates on performance."
      ];

      nextSteps.forEach(step => {
        yPos = drawJustifiedText(page5, step, leftMargin, yPos, contentWidth, font, 11);
        yPos -= 15;
      });

      yPos -= 30;

      // Conclusion
      page5.drawText("Conclusion", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 30;

      const conclusion = "This private equity strategy offers a compelling opportunity for superior growth on your investment by leveraging equity in high-growth, privately held businesses. With disciplined risk management and sector expertise, we are confident in delivering superior returns.";
      yPos = drawJustifiedText(page5, conclusion, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 25;

      const thankYou = "Thank you for your consideration. Please reach out to me if there are further concerns or let's discuss how we can tailor this strategy to your goals.";
      yPos = drawJustifiedText(page5, thankYou, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 40;
      page5.drawText("Kind Regards", { x: leftMargin, y: yPos, size: 11, font: boldFont });

      yPos -= 60;

      // Disclaimer - separated with proper spacing
      const disclaimerText = "*Disclaimer: This proposal is for illustrative purposes only. Past performance is not indicative of future results. Private equity involves risk, including potential loss of capital. Investors should conduct independent due diligence before committing funds.";
      yPos = drawJustifiedText(page5, disclaimerText, leftMargin, yPos, contentWidth, font, 9, 15);

      yPos -= 25;

      const proposalText = "*This proposal, when signed and accepted, will become part of the Agreement with the client";
      yPos = drawJustifiedText(page5, proposalText, leftMargin, yPos, contentWidth, font, 9, 15);

      // === PAGE 6: CLIENT CONFIRMATION ===
      const page6 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page6);
      addLogo(page6);
      yPos = 750;

      // CLIENT CONFIRMATION
      page6.drawText("CLIENT CONFIRMATION", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 30;

      const confirmationText = "I, The undersigned, hereby accept the proposal as outlined in the documentation contained herein. I confirmed that I had made an informed decision based on my own financial product experience and/or external consultation with professionals. I confirm that I have the financial capacity to enter into this agreement and also the additional financial resources which allow me the opportunity to enter the waiting periods/ lock up periods/ and or risk associated with this product";
      yPos = drawJustifiedText(page6, confirmationText, leftMargin, yPos, contentWidth, font, 10, 16);

      yPos -= 50;

      // Signature fields with proper spacing
      page6.drawText(`Signed at _________________ on _______ 202_`, { 
        x: leftMargin, 
        y: yPos, 
        size: 10, 
        font 
      });
      yPos -= 40;

      page6.drawText("Signature of Client: _________________________", { 
        x: leftMargin, 
        y: yPos, 
        size: 10, 
        font 
      });
      yPos -= 30;

      page6.drawText("Name of Client: _____________________________", { 
        x: leftMargin, 
        y: yPos, 
        size: 10, 
        font 
      });
      yPos -= 30;

      page6.drawText("Date Signed: ________________________________", { 
        x: leftMargin, 
        y: yPos, 
        size: 10, 
        font 
      });

      // === Save & Send ===
      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="proposal-${proposal.clientName.replace(/\s+/g, "-")}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}