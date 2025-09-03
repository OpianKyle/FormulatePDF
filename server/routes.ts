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

      // Calculate target return percentage based on dividend projections
      const targetValue = year3Value; // Use final year value from dividends
      const calculatedTargetReturn = ((targetValue - proposal.investmentAmount) / proposal.investmentAmount) * 100;
      const totalProfit = targetValue - proposal.investmentAmount;
      const annualizedReturn =
        Math.pow(targetValue / proposal.investmentAmount, 1 / proposal.timeHorizon) - 1;

      // Load and embed images
      let coverImage, logoImage: any, signatureImage;
      try {
        const imagePath = path.join(
          __dirname,
          "../attached_assets/image_1756730534595.png"
        );
        const imageBytes = await fs.readFile(imagePath);
        coverImage = await pdfDoc.embedPng(imageBytes);
      } catch (error) {
        console.warn("Could not load cover image, using text-only cover page");
      }

      try {
        const logoPath = path.join(
          __dirname,
          "../attached_assets/image_1756901569236.png"
        );
        const logoBytes = await fs.readFile(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (error) {
        console.warn("Could not load logo image");
      }

      try {
        const signaturePath = path.join(
          __dirname,
          "../attached_assets/image_1756732618787.png"
        );
        const signatureBytes = await fs.readFile(signaturePath);
        signatureImage = await pdfDoc.embedPng(signatureBytes);
      } catch (error) {
        console.warn("Could not load signature image");
      }

      // Fonts
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // ✅ Helper: Draw fully justified text
      const drawJustifiedText = (
        page: any,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        font: any,
        fontSize: number = 10,
        lineSpacing: number = 14
      ) => {
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
            page.drawText(lineText, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
          } else {
            const extraSpace = (maxWidth - lineWidth) / (lineWords.length - 1);
            let cursorX = x;
            lineWords.forEach((word) => {
              page.drawText(word, { x: cursorX, y, size: fontSize, font, color: rgb(0, 0, 0) });
              cursorX += font.widthOfTextAtSize(word, fontSize) + extraSpace;
            });
          }
          y -= lineSpacing;
        });

        return y;
      };

      // Footer
      const addFooterToPage = (page: any) => {
        const footerY = 40;
        const leftMargin = 40;
        page.drawText("Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974",
          { x: leftMargin, y: footerY + 30, size: 8, font, color: rgb(0, 0, 0) });
        page.drawText("Company Registration Number: 2022/272376/07 FSP No: 50974",
          { x: leftMargin, y: footerY + 20, size: 8, font, color: rgb(0, 0, 0) });
        page.drawText("Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape",
          { x: leftMargin, y: footerY + 10, size: 8, font, color: rgb(0, 0, 0) });
        page.drawText("Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com",
          { x: leftMargin, y: footerY, size: 8, font, color: rgb(0, 0, 0) });
      };

      // Add logo to top right of content pages
      const addLogoToPage = (page: any) => {
        if (logoImage) {
          const logoWidth = 120;
          const logoHeight = 40;
          const pageWidth = 595.28;
          const x = pageWidth - logoWidth - 40; // 40px margin from right edge
          const y = 800; // Top of page with margin
          
          page.drawImage(logoImage, {
            x: x,
            y: y,
            width: logoWidth,
            height: logoHeight,
          });
        }
      };

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
        // Text-only cover page with proper company header
        let yPos = 800;
        const leftMargin = 40;
        
        // Company header
        coverPage.drawText("OPIAN CAPITAL", {
          x: leftMargin,
          y: yPos,
          size: 24,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        
        yPos -= 30;
        coverPage.drawText("PRIVATE EQUITY PROPOSAL", {
          x: leftMargin,
          y: yPos,
          size: 18,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        
        yPos -= 25;
        coverPage.drawText("Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974", {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        
        yPos -= 15;
        coverPage.drawText("Company Registration Number: 2022/272376/07 FSP No: 50974", {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        
        yPos -= 15;
        coverPage.drawText("Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape", {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        
        yPos -= 15;
        coverPage.drawText("Tel: 0861 263 346 I Email: info@opianfsgroup.com I Website: www.opianfsgroup.com", {
          x: leftMargin,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
      }

      // PAGE 1
      const page1 = pdfDoc.addPage([595.28, 841.89]);
      addFooterToPage(page1);
      addLogoToPage(page1);
      let yPos = 780;
      const leftMargin = 40;
      const contentWidth = 595.28 - 80;

      // Title
      const titleText = `Turning R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} (${calculatedTargetReturn.toFixed(0)}% Growth) in ${proposal.timeHorizon} Years`;
      page1.drawText(titleText, { x: leftMargin, y: yPos, size: 14, font: boldFont });

      yPos -= 25;
      page1.drawText(`Prepared for: ${proposal.clientName}`, { x: leftMargin, y: yPos, size: 11, font: boldFont });

      yPos -= 20;
      page1.drawText(`Date: ${proposal.proposalDate}`, { x: leftMargin, y: yPos, size: 11, font: boldFont });

      yPos -= 25;
      page1.drawText("Address:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 15;
      proposal.clientAddress.split("\\n").forEach((line) => {
        page1.drawText(line, { x: leftMargin, y: yPos, size: 10, font });
        yPos -= 15;
      });

      yPos -= 80;
      page1.drawText(`Dear ${proposal.clientName}`, { x: leftMargin, y: yPos, size: 16, font: boldFont });

      yPos -= 30;
      page1.drawText("We thank you for your interest in our Private Equity Proposal",
        { x: leftMargin, y: yPos, size: 10, font });

      // Executive Summary
      yPos -= 30;
      page1.drawText("1. Executive Summary", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;
      const executiveSummary = `This proposal outlines a strategic private equity (PE) investment strategy designed to grow an initial capital of R${proposal.investmentAmount.toLocaleString()} by ${calculatedTargetReturn.toFixed(0)}% (R${targetValue.toLocaleString()} total) over a ${proposal.timeHorizon}-year horizon. By leveraging high-growth private equity opportunities in carefully selected industries, we aim to maximize returns while mitigating risks through diversification and expert fund management.`;
      yPos = drawJustifiedText(page1, executiveSummary, leftMargin, yPos, contentWidth, font, 10);

      yPos -= 15;
      page1.drawText("Key Highlights:", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 20;

      const highlights = [
        `• Target Return: ${calculatedTargetReturn.toFixed(0)}% growth (R${totalProfit.toLocaleString()} profit) in ${proposal.timeHorizon} years (~${(annualizedReturn * 100).toFixed(1)}% annualised return).`,
        "• Investment Strategy: Focus on growth equity in high-potential sectors.",
        "• Risk Management: Portfolio diversification, and active management.",
        `• Exit Strategy: Share buybacks, IPOs, or secondary buyouts after ${proposal.timeHorizon} years.`
      ];

      highlights.forEach((highlight) => {
        yPos = drawJustifiedText(page1, highlight, leftMargin, yPos, contentWidth, font, 10);
        yPos -= 5;
      });

      // Market Outlook
      yPos -= 20;
      page1.drawText("2. Investment Opportunity & Market Outlook",
        { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;
      const marketText = "Private equity has historically outperformed public markets, delivering 12-25%+ annual returns in emerging markets like South Africa and BRICS. Key sectors with strong growth potential include:";
      yPos = drawJustifiedText(page1, marketText, leftMargin, yPos, contentWidth, font, 10);

      yPos -= 10;
      const sectors = [
        "Technology & FinTech (Digital payments, SaaS, AI Related business)",
        "Consumer Goods & Retail (E-commerce, premium brands, Rewards, Lifestyle products)",
        "Healthcare & Biotechnology (Telemedicine, generics manufacturing)",
        "Renewable Energy (Solar, battery storage)"
      ];

      sectors.forEach((sector) => {
        page1.drawText(sector, { x: leftMargin, y: yPos, size: 10, font, color: rgb(0, 0, 0) });
        yPos -= 14;
      });

      yPos -= 10;
      const investText = "By investing in early stage but undervalued businesses with strong cash flow, IP and scalability, we position the portfolio for accelerated growth.";
      yPos = drawJustifiedText(page1, investText, leftMargin, yPos, contentWidth, font, 10);

      // PAGE 2 - Investment Structure
      const page2 = pdfDoc.addPage([595.28, 841.89]);
      addFooterToPage(page2);
      addLogoToPage(page2);
      yPos = 780;

      page2.drawText("3. Proposed Investment Structure", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 25;

      // Investment Structure Table
      const tableData = [
        ["Component", "Details"],
        ["Investment Amount", `R${proposal.investmentAmount.toLocaleString()},00`],
        ["Target Return", `R${targetValue.toLocaleString()},00 (${calculatedTargetReturn.toFixed(0)}% growth)`],
        ["Time Horizon", `${proposal.timeHorizon} years`],
        ["Annualised Return", `~${(annualizedReturn * 100).toFixed(0)}%`],
        ["Investment Vehicle", "Private Equity / Direct Investment"],
        ["Key Sectors", "FinTech, Lifestyle, Online Education"]
      ];

      // Draw simple table
      const tableStartY = yPos;
      const rowHeight = 20;
      const col1Width = 140;
      const col2Width = 300;

      tableData.forEach((row, index) => {
        const isHeader = index === 0;
        const currentY = tableStartY - (index * rowHeight);
        
        // Draw table border
        page2.drawRectangle({
          x: leftMargin,
          y: currentY - rowHeight + 5,
          width: col1Width + col2Width,
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });

        // Content
        page2.drawText(row[0], {
          x: leftMargin + 5,
          y: currentY - 12,
          size: 10,
          font: isHeader ? boldFont : font,
          color: rgb(0, 0, 0),
        });
        
        page2.drawText(row[1], {
          x: leftMargin + col1Width + 5,
          y: currentY - 12,
          size: 10,
          font: isHeader ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      });

      yPos = tableStartY - (rowHeight * tableData.length) - 20;

      // Why Private Equity section
      page2.drawText("Why Private Equity?", { x: leftMargin, y: yPos, size: 10, font: boldFont });
      yPos -= 15;

      const peReasons = [
        "• Higher Returns: PE typically outperforms stocks & bonds.",
        "• Active Value Creation: Hands-on management improves business performance.",
        "• Lower Volatility: Unlike public markets, PE is less exposed to short-term fluctuations."
      ];

      peReasons.forEach((reason) => {
        yPos = drawJustifiedText(page2, reason, leftMargin, yPos, contentWidth, font, 10);
        yPos -= 5;
      });

      yPos -= 20;

      // Projected Returns & Cash Flow
      page2.drawText("4. Projected Returns & Cash Flow", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 25;

      // Cash Flow Table
      const cashFlowData = [
        ["Year", "Shares Issued", "Div Allocation", "Div Return", "Growth (%)", "Investment Value"],
        ["Year 0", "-", "-", "-", "-", `R${proposal.investmentAmount.toLocaleString()},00`],
        ["Year 1", Math.floor(sharesIssued).toLocaleString(), proposal.year1Dividend.toFixed(3), `R${year1Return.toLocaleString()},00`, `${year1Growth.toFixed(2)}%`, `R${year1Value.toLocaleString()},00`],
        ["Year 2", Math.floor(sharesIssued).toLocaleString(), proposal.year2Dividend.toFixed(3), `R${year2Return.toLocaleString()},00`, `${year2Growth.toFixed(2)}%`, `R${year2Value.toLocaleString()},00`],
        ["Year 3", Math.floor(sharesIssued).toLocaleString(), proposal.year3Dividend.toFixed(3), `R${year3Return.toLocaleString()},00`, `${year3Growth.toFixed(2)}%`, `R${year3Value.toLocaleString()},00`]
      ];

      // Draw cash flow table
      const colWidths = [40, 75, 75, 75, 60, 95];
      const tableTop = yPos;
      
      cashFlowData.forEach((row, rowIndex) => {
        const isHeader = rowIndex === 0;
        const currentY = tableTop - (rowIndex * 18);
        
        let xPos = leftMargin;
        row.forEach((cell, colIndex) => {
          // Draw cell border
          page2.drawRectangle({
            x: xPos,
            y: currentY - 18,
            width: colWidths[colIndex],
            height: 18,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
          });
          
          // Draw text
          page2.drawText(cell, {
            x: xPos + 3,
            y: currentY - 12,
            size: 8,
            font: isHeader ? boldFont : font,
            color: rgb(0, 0, 0),
          });
          
          xPos += colWidths[colIndex];
        });
      });

      yPos = tableTop - (18 * cashFlowData.length) - 20;

      // Notes
      const notes = [
        "• Note: While returns are based on historical PE performance; actual results may vary.",
        "• Fund Value is non liquid",
        "• The investment is locked into the period with no access to investment"
      ];

      notes.forEach((note) => {
        yPos = drawJustifiedText(page2, note, leftMargin, yPos, contentWidth, font, 10);
        yPos -= 5;
      });

      // PAGE 3 - Risk & Conclusion
      const page3 = pdfDoc.addPage([595.28, 841.89]);
      addFooterToPage(page3);
      addLogoToPage(page3);
      yPos = 780;

      // Risk Mitigation Strategy
      page3.drawText("5. Risk Mitigation Strategy", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 15;
      
      const riskIntro = "To safeguard capital while pursuing high returns, we implement:";
      yPos = drawJustifiedText(page3, riskIntro, leftMargin, yPos, contentWidth, font, 10);
      yPos -= 10;

      const riskStrategies = [
        "• Diversification across 1-5 high-growth potential companies",
        "• Due Diligence on management teams, financials, and market trends",
        "• Structured Exit Plans (Share swops, IPO, recapitalization, buyouts)",
        "• Co-Investment Model (Reduces exposure via partnerships)"
      ];

      riskStrategies.forEach((strategy) => {
        yPos = drawJustifiedText(page3, strategy, leftMargin, yPos, contentWidth, font, 10);
        yPos -= 5;
      });

      yPos -= 15;

      // Why Invest With Us section
      page3.drawText("6. Why Invest With Us?", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 15;

      const whyUs = [
        "• Industry Expertise: Deep knowledge of South African & African markets",
        "• Transparent Fees: Performance-based compensation (2% management fee + 20% carry)",
        "• Aligned Interests: We invest alongside clients",
        "• Ownership: We take a large ownership and management stake in companies we invest in"
      ];

      whyUs.forEach((point) => {
        yPos = drawJustifiedText(page3, point, leftMargin, yPos, contentWidth, font, 10);
        yPos -= 5;
      });

      yPos -= 20;

      // Next Steps
      page3.drawText("7. Next Steps", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 15;

      const nextSteps = [
        "1. Decision Taking: Deciding on risk appetite & capital to be invested",
        "2. Risk Process: Making investment and completing documentation",
        "3. Capital Deployment: We begin investment within 2-6 weeks post due diligence.",
        "4. Quarterly Reporting: Transparent updates on performance."
      ];

      nextSteps.forEach((step) => {
        yPos = drawJustifiedText(page3, step, leftMargin, yPos, contentWidth, font, 10);
        yPos -= 5;
      });

      yPos -= 20;

      // Conclusion
      page3.drawText("8. Conclusion", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 15;

      const conclusion = `This private equity strategy offers a compelling opportunity to grow R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} in ${proposal.timeHorizon} years (${calculatedTargetReturn.toFixed(0)}% return) by leveraging high-growth, private-held businesses. With disciplined risk management and sector expertise, we are confident in delivering superior returns.`;
      yPos = drawJustifiedText(page3, conclusion, leftMargin, yPos, contentWidth, font, 10);

      yPos -= 15;
      const thankYou = "Thank you for your consideration. Please reach out to me if there are further concerns or let's discuss how we can tailor this strategy to your goals.";
      yPos = drawJustifiedText(page3, thankYou, leftMargin, yPos, contentWidth, font, 10);

      yPos -= 25;
      page3.drawText("Kind Regards", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;

      // Add signature image if available
      if (signatureImage) {
        page3.drawImage(signatureImage, {
          x: leftMargin,
          y: yPos - 60,
          width: 120,
          height: 40,
        });
        yPos -= 70;
      }

      page3.drawText("Lance E Heynes", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 15;
      page3.drawText("CEO", { x: leftMargin, y: yPos, size: 10, font });
      yPos -= 15;
      page3.drawText("Tel: 081 323 4297", { x: leftMargin, y: yPos, size: 10, font });
      yPos -= 12;
      page3.drawText("Email: lance@opianfsgroup.com", { x: leftMargin, y: yPos, size: 10, font });
      yPos -= 12;
      page3.drawText("Website: www.opiancapital.com", { x: leftMargin, y: yPos, size: 10, font });

      yPos -= 25;
      const disclaimer = "*Disclaimer: This proposal is for illustrative purposes only. Past performance is not indicative of future results. Private equity involves risk, including potential loss of capital. Investors should conduct independent due diligence before making investment decisions.*";
      yPos = drawJustifiedText(page3, disclaimer, leftMargin, yPos, contentWidth, font, 8);

      // Save & send
      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition",
        `attachment; filename="proposal-${proposal.clientName.replace(/\\s+/g, "-")}.pdf"`);
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