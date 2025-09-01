import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProposalSchema, type ProposalForm } from "@shared/schema";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

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

      // Create multiple pages for the full template
      const page1 = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let yPos = 800;

      // Header
      page1.drawText("OFFER LETTER", {
        x: 50,
        y: yPos,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      page1.drawText("PRIVATE EQUITY PROPOSAL", {
        x: 50,
        y: yPos,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 60;
      // Company header with license info
      const companyInfo = [
        "Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974",
        "Company Registration Number: 2022/272376/07 FSP No: 50974",
        "Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape",
        "Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com"
      ];

      companyInfo.forEach((line) => {
        page1.drawText(line, {
          x: 50,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 12;
      });

      yPos -= 20;
      page1.drawText("Private Equity Proposal", {
        x: 250,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 40;
      page1.drawText(`Turning R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} (${proposal.targetReturn}% Growth) in ${proposal.timeHorizon} Years`, {
        x: 50,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 40;
      page1.drawText("Prepared for:", {
        x: 50,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      page1.drawText(proposal.clientName, {
        x: 50,
        y: yPos,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      page1.drawText("Address:", {
        x: 50,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      // Split address into multiple lines if needed
      const addressLines = proposal.clientAddress.split('\n');
      addressLines.forEach((line) => {
        page1.drawText(line, {
          x: 50,
          y: yPos,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      });

      yPos -= 20;
      page1.drawText("Date:", {
        x: 50,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      page1.drawText(proposal.proposalDate, {
        x: 50,
        y: yPos,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 30;
      page1.drawText(`Dear ${proposal.clientName}`, {
        x: 50,
        y: yPos,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 30;
      page1.drawText("We thank you for your interest in our Private Equity Proposal", {
        x: 50,
        y: yPos,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 40;
      page1.drawText("1. Executive Summary", {
        x: 50,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      const executiveSummary = `This proposal outlines a strategic private equity (PE) investment strategy designed to grow an initial capital of R${proposal.investmentAmount.toLocaleString()} by ${proposal.targetReturn}% (R${targetValue.toLocaleString()} total) over a ${proposal.timeHorizon}-year horizon. By leveraging high-growth private equity opportunities in carefully selected industries, we aim to maximize returns while mitigating risks through diversification and expert fund management.`;
      
      // Word wrap function
      const wrapText = (text: string, maxWidth: number, fontSize: number, font: any) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const textWidth = font.widthOfTextAtSize(testLine, fontSize);
          
          if (textWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
      };

      const summaryLines = wrapText(executiveSummary, 500, 10, font);
      summaryLines.forEach((line) => {
        page1.drawText(line, {
          x: 50,
          y: yPos,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      });

      // Add second page for more content
      const page2 = pdfDoc.addPage([595.28, 841.89]);
      yPos = 800;

      // Key Highlights
      page2.drawText("Key Highlights:", {
        x: 50,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 20;
      const highlights = [
        `➢ Target Return: ${proposal.targetReturn}% growth (R${totalProfit.toLocaleString()} profit) in ${proposal.timeHorizon} years (~${(annualizedReturn * 100).toFixed(1)}% annualized return).`,
        "➢ Investment Strategy: Focus on growth equity in high-potential sectors.",
        "➢ Risk Management: Portfolio diversification, and active management.",
        `➢ Exit Strategy: Share buybacks, IPOs, or secondary buyouts after ${proposal.timeHorizon} years.`
      ];

      highlights.forEach((highlight) => {
        const highlightLines = wrapText(highlight, 500, 10, font);
        highlightLines.forEach((line) => {
          page2.drawText(line, {
            x: 70,
            y: yPos,
            size: 10,
            font,
            color: rgb(0, 0, 0),
          });
          yPos -= 15;
        });
      });

      // Proposed Investment Structure
      yPos -= 30;
      page2.drawText("3. Proposed Investment Structure", {
        x: 50,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 30;
      const structureData = [
        ["Component", "Details"],
        ["Investment Amount", `R${proposal.investmentAmount.toLocaleString()}`],
        ["Target Return", `R${targetValue.toLocaleString()} (${proposal.targetReturn}% growth)`],
        ["Time Horizon", `${proposal.timeHorizon} years`],
        ["Annualised Return", `~${(annualizedReturn * 100).toFixed(1)}%`],
        ["Investment Vehicle", "Private Equity / Direct Investment"],
        ["Key Sectors", "FinTech, Lifestyle, Online Education"]
      ];

      // Draw table
      structureData.forEach((row, index) => {
        const isHeader = index === 0;
        page2.drawText(row[0], {
          x: 50,
          y: yPos,
          size: 10,
          font: isHeader ? boldFont : font,
          color: rgb(0, 0, 0),
        });
        page2.drawText(row[1], {
          x: 300,
          y: yPos,
          size: 10,
          font: isHeader ? boldFont : font,
          color: rgb(0, 0, 0),
        });
        yPos -= 18;
      });

      // Projected Returns & Cash Flow
      yPos -= 30;
      page2.drawText("4. Projected Returns & Cash Flow", {
        x: 50,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 30;
      // Table headers
      const headers = ["Year", "Shares Issued", "Div Allocation", "Div Return", "Growth (%)", "Investment Value"];
      const xPositions = [50, 120, 200, 280, 360, 440];
      
      headers.forEach((header, i) => {
        page2.drawText(header, {
          x: xPositions[i],
          y: yPos,
          size: 9,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      });

      yPos -= 20;
      
      // Table data
      const tableData = [
        ["Year 0", "-", "-", "-", "-", `R${proposal.investmentAmount.toLocaleString()}`],
        ["Year 1", Math.floor(sharesIssued).toLocaleString(), proposal.year1Dividend.toFixed(3), `R${year1Return.toLocaleString()}`, `${year1Growth.toFixed(2)}%`, `R${year1Value.toLocaleString()}`],
        ["Year 2", Math.floor(sharesIssued).toLocaleString(), proposal.year2Dividend.toFixed(3), `R${year2Return.toLocaleString()}`, `${year2Growth.toFixed(2)}%`, `R${year2Value.toLocaleString()}`],
        ["Year 3", Math.floor(sharesIssued).toLocaleString(), proposal.year3Dividend.toFixed(3), `R${year3Return.toLocaleString()}`, `${year3Growth.toFixed(2)}%`, `R${year3Value.toLocaleString()}`]
      ];

      tableData.forEach((row) => {
        row.forEach((cell, i) => {
          page2.drawText(cell, {
            x: xPositions[i],
            y: yPos,
            size: 8,
            font,
            color: rgb(0, 0, 0),
          });
        });
        yPos -= 18;
      });

      // Notes
      yPos -= 20;
      const notes = [
        "• Note: While returns are based on historical PE performance; actual results may vary.",
        "• Fund Value is non liquid",
        "• The investment is locked into the period with no access to investment"
      ];

      notes.forEach((note) => {
        page2.drawText(note, {
          x: 70,
          y: yPos,
          size: 9,
          font,
          color: rgb(0, 0, 0),
        });
        yPos -= 15;
      });

      // Footer on both pages
      const footerLines = [
        "Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974",
        "Company Registration Number: 2022/272376/07 FSP No: 50974",
        "Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape",
        "Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com"
      ];

      [page1, page2].forEach((page) => {
        let footerY = 50;
        footerLines.forEach((line) => {
          page.drawText(line, {
            x: 50,
            y: footerY,
            size: 7,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });
          footerY -= 10;
        });
      });

      const pdfBytes = await pdfDoc.save();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.clientName.replace(/\s+/g, '-')}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
