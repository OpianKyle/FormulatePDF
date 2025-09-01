import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  clientAddress: text("client_address").notNull(),
  proposalDate: text("proposal_date").notNull(),
  investmentAmount: real("investment_amount").notNull(),
  targetReturn: real("target_return").notNull(),
  timeHorizon: real("time_horizon").notNull(),
  year1Dividend: real("year1_dividend").notNull(),
  year2Dividend: real("year2_dividend").notNull(),
  year3Dividend: real("year3_dividend").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
});

export const proposalFormSchema = insertProposalSchema.extend({
  clientName: z.string().min(1, "Client name is required"),
  clientAddress: z.string().min(1, "Client address is required"),
  proposalDate: z.string().min(1, "Proposal date is required"),
  investmentAmount: z.number().min(1000, "Investment amount must be at least R 1,000"),
  targetReturn: z.number().min(1, "Target return must be at least 1%").max(200, "Target return cannot exceed 200%"),
  timeHorizon: z.number().min(1, "Time horizon must be at least 1 year").max(10, "Time horizon cannot exceed 10 years"),
  year1Dividend: z.number().min(0, "Year 1 dividend allocation cannot be negative"),
  year2Dividend: z.number().min(0, "Year 2 dividend allocation cannot be negative"),
  year3Dividend: z.number().min(0, "Year 3 dividend allocation cannot be negative"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;
export type ProposalForm = z.infer<typeof proposalFormSchema>;
