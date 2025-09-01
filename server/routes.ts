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
        const imagePath = path.join(__dirname, '../attached_assets/image_1756727022157.png');
        const imageBytes = await fs.readFile(imagePath);
        coverImage = await pdfDoc.embedPng(imageBytes);
      } catch (error) {
        console.warn('Could not load cover image, using text-only cover page');
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

      // Create content page
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
      
      // Company info
      page1.drawText("Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974", {
        x: 50,
        y: yPos,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });
      yPos -= 12;
      
      page1.drawText("Company Registration Number: 2022/272376/07 FSP No: 50974", {
        x: 50,
        y: yPos,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });
      yPos -= 12;
      
      page1.drawText("Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape", {
        x: 50,
        y: yPos,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });
      yPos -= 12;
      
      page1.drawText("Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com", {
        x: 50,
        y: yPos,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 40;
      page1.drawText("Private Equity Proposal", {
        x: 250,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 40;
      const titleText = `Turning R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} (${proposal.targetReturn}% Growth) in ${proposal.timeHorizon} Years`;
      page1.drawText(titleText, {
        x: 50,
        y: yPos,
        size: 12,
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
      page1.drawText(proposal.clientAddress, {
        x: 50,
        y: yPos,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      yPos -= 30;
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
      const summaryText = `This proposal outlines a strategic private equity investment strategy designed to grow`;
      page1.drawText(summaryText, {
        x: 50,
        y: yPos,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
      
      yPos -= 15;
      const summaryText2 = `an initial capital of R${proposal.investmentAmount.toLocaleString()} by ${proposal.targetReturn}% over a ${proposal.timeHorizon}-year horizon.`;
      page1.drawText(summaryText2, {
        x: 50,
        y: yPos,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });

      // Create second page
      const page2 = pdfDoc.addPage([595.28, 841.89]);
      yPos = 800;

      // Projected Returns & Cash Flow
      page2.drawText("4. Projected Returns & Cash Flow", {
        x: 50,
        y: yPos,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      yPos -= 40;
      // Table headers
      page2.drawText("Year", { x: 50, y: yPos, size: 10, font: boldFont });
      page2.drawText("Shares Issued", { x: 120, y: yPos, size: 10, font: boldFont });
      page2.drawText("Div Allocation", { x: 200, y: yPos, size: 10, font: boldFont });
      page2.drawText("Div Return", { x: 280, y: yPos, size: 10, font: boldFont });
      page2.drawText("Growth %", { x: 360, y: yPos, size: 10, font: boldFont });
      page2.drawText("Investment Value", { x: 440, y: yPos, size: 10, font: boldFont });

      yPos -= 25;
      
      // Year 0
      page2.drawText("Year 0", { x: 50, y: yPos, size: 9, font });
      page2.drawText("-", { x: 120, y: yPos, size: 9, font });
      page2.drawText("-", { x: 200, y: yPos, size: 9, font });
      page2.drawText("-", { x: 280, y: yPos, size: 9, font });
      page2.drawText("-", { x: 360, y: yPos, size: 9, font });
      page2.drawText(`R${proposal.investmentAmount.toLocaleString()}`, { x: 440, y: yPos, size: 9, font });

      yPos -= 20;
      
      // Year 1
      page2.drawText("Year 1", { x: 50, y: yPos, size: 9, font });
      page2.drawText(Math.floor(sharesIssued).toLocaleString(), { x: 120, y: yPos, size: 9, font });
      page2.drawText(proposal.year1Dividend.toFixed(3), { x: 200, y: yPos, size: 9, font });
      page2.drawText(`R${year1Return.toLocaleString()}`, { x: 280, y: yPos, size: 9, font });
      page2.drawText(`${year1Growth.toFixed(2)}%`, { x: 360, y: yPos, size: 9, font });
      page2.drawText(`R${year1Value.toLocaleString()}`, { x: 440, y: yPos, size: 9, font });

      yPos -= 20;
      
      // Year 2
      page2.drawText("Year 2", { x: 50, y: yPos, size: 9, font });
      page2.drawText(Math.floor(sharesIssued).toLocaleString(), { x: 120, y: yPos, size: 9, font });
      page2.drawText(proposal.year2Dividend.toFixed(3), { x: 200, y: yPos, size: 9, font });
      page2.drawText(`R${year2Return.toLocaleString()}`, { x: 280, y: yPos, size: 9, font });
      page2.drawText(`${year2Growth.toFixed(2)}%`, { x: 360, y: yPos, size: 9, font });
      page2.drawText(`R${year2Value.toLocaleString()}`, { x: 440, y: yPos, size: 9, font });

      yPos -= 20;
      
      // Year 3
      page2.drawText("Year 3", { x: 50, y: yPos, size: 9, font });
      page2.drawText(Math.floor(sharesIssued).toLocaleString(), { x: 120, y: yPos, size: 9, font });
      page2.drawText(proposal.year3Dividend.toFixed(3), { x: 200, y: yPos, size: 9, font });
      page2.drawText(`R${year3Return.toLocaleString()}`, { x: 280, y: yPos, size: 9, font });
      page2.drawText(`${year3Growth.toFixed(2)}%`, { x: 360, y: yPos, size: 9, font });
      page2.drawText(`R${year3Value.toLocaleString()}`, { x: 440, y: yPos, size: 9, font });

      // Footer on content pages
      const footerY = 50;
      page1.drawText("Opian Capital (Pty) Ltd - FSP No: 50974", {
        x: 50,
        y: footerY,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
      
      page2.drawText("Opian Capital (Pty) Ltd - FSP No: 50974", {
        x: 50,
        y: footerY,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
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
