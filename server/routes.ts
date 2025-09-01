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
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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

      // Header
      page.drawText("OPIAN CAPITAL", {
        x: 50,
        y: 750,
        size: 24,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      page.drawText("PRIVATE EQUITY PROPOSAL", {
        x: 50,
        y: 720,
        size: 16,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Client details
      page.drawText(`Prepared for: ${proposal.clientName}`, {
        x: 50,
        y: 680,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(`Address: ${proposal.clientAddress}`, {
        x: 50,
        y: 660,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(`Date: ${proposal.proposalDate}`, {
        x: 50,
        y: 640,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      // Investment summary
      const targetValue = proposal.investmentAmount * (1 + proposal.targetReturn / 100);
      page.drawText(`Turning R${proposal.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} (${proposal.targetReturn}% Growth) in ${proposal.timeHorizon} Years`, {
        x: 50,
        y: 600,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Table headers
      let yPosition = 500;
      page.drawText("Year", { x: 50, y: yPosition, size: 10, font: boldFont });
      page.drawText("Shares", { x: 120, y: yPosition, size: 10, font: boldFont });
      page.drawText("Div Allocation", { x: 180, y: yPosition, size: 10, font: boldFont });
      page.drawText("Div Return", { x: 280, y: yPosition, size: 10, font: boldFont });
      page.drawText("Growth %", { x: 360, y: yPosition, size: 10, font: boldFont });
      page.drawText("Investment Value", { x: 430, y: yPosition, size: 10, font: boldFont });

      // Year 0
      yPosition -= 20;
      page.drawText("Year 0", { x: 50, y: yPosition, size: 10, font });
      page.drawText("-", { x: 120, y: yPosition, size: 10, font });
      page.drawText("-", { x: 180, y: yPosition, size: 10, font });
      page.drawText("-", { x: 280, y: yPosition, size: 10, font });
      page.drawText("-", { x: 360, y: yPosition, size: 10, font });
      page.drawText(`R ${proposal.investmentAmount.toLocaleString()}`, { x: 430, y: yPosition, size: 10, font });

      // Year 1
      yPosition -= 20;
      page.drawText("Year 1", { x: 50, y: yPosition, size: 10, font });
      page.drawText(Math.floor(sharesIssued).toLocaleString(), { x: 120, y: yPosition, size: 10, font });
      page.drawText(proposal.year1Dividend.toFixed(3), { x: 180, y: yPosition, size: 10, font });
      page.drawText(`R ${year1Return.toLocaleString()}`, { x: 280, y: yPosition, size: 10, font });
      page.drawText(`${year1Growth.toFixed(2)}%`, { x: 360, y: yPosition, size: 10, font });
      page.drawText(`R ${year1Value.toLocaleString()}`, { x: 430, y: yPosition, size: 10, font });

      // Year 2
      yPosition -= 20;
      page.drawText("Year 2", { x: 50, y: yPosition, size: 10, font });
      page.drawText(Math.floor(sharesIssued).toLocaleString(), { x: 120, y: yPosition, size: 10, font });
      page.drawText(proposal.year2Dividend.toFixed(3), { x: 180, y: yPosition, size: 10, font });
      page.drawText(`R ${year2Return.toLocaleString()}`, { x: 280, y: yPosition, size: 10, font });
      page.drawText(`${year2Growth.toFixed(2)}%`, { x: 360, y: yPosition, size: 10, font });
      page.drawText(`R ${year2Value.toLocaleString()}`, { x: 430, y: yPosition, size: 10, font });

      // Year 3
      yPosition -= 20;
      page.drawText("Year 3", { x: 50, y: yPosition, size: 10, font });
      page.drawText(Math.floor(sharesIssued).toLocaleString(), { x: 120, y: yPosition, size: 10, font });
      page.drawText(proposal.year3Dividend.toFixed(3), { x: 180, y: yPosition, size: 10, font });
      page.drawText(`R ${year3Return.toLocaleString()}`, { x: 280, y: yPosition, size: 10, font });
      page.drawText(`${year3Growth.toFixed(2)}%`, { x: 360, y: yPosition, size: 10, font });
      page.drawText(`R ${year3Value.toLocaleString()}`, { x: 430, y: yPosition, size: 10, font });

      // Footer
      page.drawText("Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974", {
        x: 50,
        y: 100,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      page.drawText("Company Registration Number: 2022/272376/07 FSP No: 50974", {
        x: 50,
        y: 85,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      page.drawText("Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape", {
        x: 50,
        y: 70,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      page.drawText("Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com", {
        x: 50,
        y: 55,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
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
