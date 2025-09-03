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
      const leftMargin = 50;
      const contentWidth = 495;

      // === Helpers ===
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
        text = text.replace(/\s+/g, " ").trim(); // normalize spacing
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
            // Last line or single word - no justification
            page.drawText(lineText, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
          } else {
            // Justify text by adding extra space between words
            const normalSpaceWidth = font.widthOfTextAtSize(" ", fontSize);
            const totalNormalSpaces = normalSpaceWidth * (lineWords.length - 1);
            const totalWordWidth = lineWidth - totalNormalSpaces;
            const extraSpaceNeeded = maxWidth - totalWordWidth - totalNormalSpaces;
            const extraSpacePerGap = extraSpaceNeeded / (lineWords.length - 1);
            
            let cursorX = x;
            lineWords.forEach((word, wordIndex) => {
              page.drawText(word, { x: cursorX, y, size: fontSize, font, color: rgb(0, 0, 0) });
              if (wordIndex < lineWords.length - 1) {
                cursorX += font.widthOfTextAtSize(word, fontSize) + normalSpaceWidth + extraSpacePerGap;
              }
            });
          }
          y -= lineSpacing;
        });

        return y;
      };

      // Check if content fits on page and create new page if needed
      const checkPageOverflow = (currentPage: any, yPos: number, minSpaceNeeded: number = 100) => {
        if (yPos < minSpaceNeeded) {
          const newPage = pdfDoc.addPage([595.28, 841.89]);
          addFooterToPage(newPage);
          addLogoToPage(newPage);
          return { page: newPage, yPos: 750 };
        }
        return { page: currentPage, yPos };
      };

      const addFooterToPage = (page: any) => {
        const footerY = 40;
        page.drawText("Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974",
          { x: leftMargin, y: footerY + 30, size: 8, font, color: rgb(0, 0, 0) });
        page.drawText("Company Registration Number: 2022/272376/07 FSP No: 50974",
          { x: leftMargin, y: footerY + 20, size: 8, font, color: rgb(0, 0, 0) });
        page.drawText("Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape",
          { x: leftMargin, y: footerY + 10, size: 8, font, color: rgb(0, 0, 0) });
        page.drawText("Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com",
          { x: leftMargin, y: footerY, size: 8, font, color: rgb(0, 0, 0) });
      };

      // Load logo image once
      let logoImage: any = null;
      try {
        const logoPath = path.join(__dirname, "../attached_assets/image_1756901569236.png");
        const logoBytes = await fs.readFile(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (error) {
        console.warn("Could not load logo image");
      }

      // Add logo to top right of content pages (larger size)
      const addLogoToPage = (page: any) => {
        if (logoImage) {
          const logoWidth = 160; // Increased from previous 120
          const logoHeight = 53; // Increased proportionally
          const pageWidth = 595.28;
          const x = pageWidth - logoWidth - 40;
          const y = 740; // Top of page with margin
          
          page.drawImage(logoImage, {
            x: x,
            y: y,
            width: logoWidth,
            height: logoHeight,
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

      // === Cover Page ===
      const coverPage = pdfDoc.addPage([595.28, 841.89]);
      coverPage.drawText("OPIAN CAPITAL", { x: 200, y: 700, size: 28, font: boldFont });
      coverPage.drawText("PRIVATE EQUITY PROPOSAL", { x: 180, y: 660, size: 18, font: boldFont });

      // === Page 1: Executive Summary ===
      let currentPage = pdfDoc.addPage([595.28, 841.89]);
      addFooterToPage(currentPage);
      addLogoToPage(currentPage);
      let yPos = 750; // Lower start to accommodate larger logo

      currentPage.drawText(`Prepared for: ${proposal.clientName}`, { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 20;
      currentPage.drawText(`Date: ${proposal.proposalDate}`, { x: leftMargin, y: yPos, size: 11, font });
      yPos -= 40;

      // Check if we need a new page
      let pageResult = checkPageOverflow(currentPage, yPos, 150);
      currentPage = pageResult.page;
      yPos = pageResult.yPos;

      currentPage.drawText("1. Executive Summary", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 20;
      const executiveSummary = `This proposal outlines a strategic private equity investment designed to grow an initial capital of R${proposal.investmentAmount.toLocaleString()} by ${proposal.targetReturn}% (R${targetValue.toLocaleString()} total) over a ${proposal.timeHorizon}-year horizon. By leveraging high-growth opportunities, we aim to maximize returns while mitigating risks through diversification and expert management.`;
      yPos = drawJustifiedText(currentPage, executiveSummary, leftMargin, yPos, contentWidth, font, 10);
      
      // Additional content for executive summary
      yPos -= 20;
      const additionalSummary = "Our investment approach focuses on identifying undervalued companies with strong growth potential, experienced management teams, and scalable business models. Through active portfolio management and strategic guidance, we work closely with investee companies to unlock value and drive sustainable growth.";
      yPos = drawJustifiedText(currentPage, additionalSummary, leftMargin, yPos, contentWidth, font, 10);

      // Check if we need a new page
      pageResult = checkPageOverflow(currentPage, yPos, 200);
      currentPage = pageResult.page;
      yPos = pageResult.yPos;

      currentPage.drawText("2. Investment Opportunity & Market Outlook", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 20;
      yPos = drawJustifiedText(currentPage, "Private equity has historically outperformed public markets, delivering average annual returns of 12-15% over the long term. The current market environment presents exceptional opportunities in key growth sectors:", leftMargin, yPos, contentWidth, font, 10);
      yPos -= 15;
      ["• Technology & FinTech (Digital payments, SaaS platforms, AI solutions)",
       "• Consumer Goods & Retail (E-commerce platforms, premium brands)",
       "• Healthcare & Biotechnology (Telemedicine, pharmaceutical manufacturing)",
       "• Renewable Energy (Solar power, battery storage solutions)",
       "• Financial Services (Alternative lending, insurance technology)"].forEach(line => {
        currentPage.drawText(line, { x: leftMargin + 15, y: yPos, size: 10, font });
        yPos -= 14;
      });

      yPos -= 20;
      const marketAnalysis = "South Africa's emerging market status, combined with a growing middle class and increasing digitalization, creates significant opportunities for private equity investments. We focus on businesses that can benefit from these macro trends while providing essential services or products to the domestic and regional markets.";
      yPos = drawJustifiedText(currentPage, marketAnalysis, leftMargin, yPos, contentWidth, font, 10);

      // Check if we need a new page for the investment structure
      pageResult = checkPageOverflow(currentPage, yPos, 250);
      currentPage = pageResult.page;
      yPos = pageResult.yPos;

      currentPage.drawText("3. Proposed Investment Structure", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      // Investment Structure Table
      const tableData = [
        ["Component", "Details"],
        ["Investment Amount", `R${proposal.investmentAmount.toLocaleString()}`],
        ["Target Value", `R${targetValue.toLocaleString()} (${proposal.targetReturn}%)`],
        ["Time Horizon", `${proposal.timeHorizon} years`],
        ["Shares Issued", sharesIssued.toFixed(0)],
      ];
      const colWidths = [150, 300];
      let tableY = yPos;

      // Border
      currentPage.drawRectangle({ x: leftMargin, y: tableY - tableData.length * 20, width: colWidths[0] + colWidths[1], height: tableData.length * 20, borderColor: rgb(0, 0, 0), borderWidth: 1 });

      // Rows
      tableData.forEach((row, i) => {
        const y = tableY - i * 20 - 14;
        if (i > 0) {
          currentPage.drawLine({ start: { x: leftMargin, y: tableY - i * 20 }, end: { x: leftMargin + colWidths[0] + colWidths[1], y: tableY - i * 20 }, color: rgb(0, 0, 0), thickness: 1 });
        }
        currentPage.drawText(row[0], { x: leftMargin + 5, y, size: 9, font: i === 0 ? boldFont : font });
        currentPage.drawText(row[1], { x: leftMargin + colWidths[0] + 5, y, size: 9, font: i === 0 ? boldFont : font });
      });

      // Check if we need a new page for cash flow
      pageResult = checkPageOverflow(currentPage, yPos, 200);
      currentPage = pageResult.page;
      yPos = pageResult.yPos;

      currentPage.drawText("4. Projected Returns & Cash Flow", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const cashFlowData = [
        ["Year", "Div/Share", "Return", "Value"],
        ["1", proposal.year1Dividend.toFixed(2), `R${year1Return.toLocaleString()}`, `R${year1Value.toLocaleString()}`],
        ["2", proposal.year2Dividend.toFixed(2), `R${year2Return.toLocaleString()}`, `R${year2Value.toLocaleString()}`],
        ["3", proposal.year3Dividend.toFixed(2), `R${year3Return.toLocaleString()}`, `R${year3Value.toLocaleString()}`],
      ];
      const colW = [50, 100, 120, 120];
      let tableTop = yPos;

      currentPage.drawRectangle({ x: leftMargin, y: tableTop - cashFlowData.length * 20, width: colW.reduce((a, b) => a + b, 0), height: cashFlowData.length * 20, borderColor: rgb(0, 0, 0), borderWidth: 1 });

      cashFlowData.forEach((row, i) => {
        const y = tableTop - i * 20 - 14;
        if (i > 0) {
          currentPage.drawLine({ start: { x: leftMargin, y: tableTop - i * 20 }, end: { x: leftMargin + colW.reduce((a, b) => a + b, 0), y: tableTop - i * 20 }, color: rgb(0, 0, 0), thickness: 1 });
        }
        let x = leftMargin + 5;
        row.forEach((cell, j) => {
          currentPage.drawText(cell, { x, y, size: 9, font: i === 0 ? boldFont : font });
          x += colW[j];
        });
      });

      // === Risk Management ===
      yPos = tableTop - cashFlowData.length * 20 - 40;
      
      // Check if we need a new page for conclusion section
      pageResult = checkPageOverflow(currentPage, yPos, 300);
      currentPage = pageResult.page;
      yPos = pageResult.yPos;

      currentPage.drawText("5. Risk Management Strategy", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 20;
      const riskText = "Our investment approach incorporates comprehensive risk management through portfolio diversification, thorough due diligence, and active monitoring of investee companies. We mitigate risks through strategic sector allocation and maintain strong governance oversight.";
      yPos = drawJustifiedText(currentPage, riskText, leftMargin, yPos, contentWidth, font, 10);

      yPos -= 30;
      currentPage.drawText("6. Conclusion", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 20;
      const conclusionText = `This private equity strategy offers a compelling opportunity to grow R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} in ${proposal.timeHorizon} years. With disciplined risk management, sector expertise, and proven investment methodologies, we are confident in delivering superior risk-adjusted returns that exceed traditional investment alternatives.`;
      yPos = drawJustifiedText(currentPage, conclusionText, leftMargin, yPos, contentWidth, font, 10);

      yPos -= 30;
      const nextStepsText = "We look forward to partnering with you on this investment journey and are committed to transparent communication, regular reporting, and delivering on our investment objectives. Our team stands ready to address any questions and provide additional information as needed.";
      yPos = drawJustifiedText(currentPage, nextStepsText, leftMargin, yPos, contentWidth, font, 10);

      // Check if we need a new page for client confirmation
      pageResult = checkPageOverflow(currentPage, yPos, 200);
      currentPage = pageResult.page;
      yPos = pageResult.yPos;

      // === Client Confirmation ===
      currentPage.drawText("Client Confirmation", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;
      currentPage.drawText("I, the undersigned, hereby acknowledge receipt and acceptance of this proposal.", { x: leftMargin, y: yPos, size: 10, font });
      yPos -= 60;
      currentPage.drawText("_____________________________", { x: leftMargin, y: yPos, size: 10, font });
      currentPage.drawText("Client Signature", { x: leftMargin, y: yPos - 15, size: 9, font });
      currentPage.drawText("Date: _____________________", { x: leftMargin + 250, y: yPos, size: 10, font });

      // === Disclaimer ===
      yPos -= 80;
      const disclaimerText = "*Disclaimer: This proposal is for illustrative purposes only. Past performance is not indicative of future results. Private equity investments involve risk, including potential loss of capital. Investors should conduct independent due diligence and seek professional advice before making investment decisions. All projections are estimates based on current market conditions and assumptions.*";
      drawJustifiedText(currentPage, disclaimerText, leftMargin, yPos, contentWidth, font, 8, 12);

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