export const ticketStatuses = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
export type TicketStatus = (typeof ticketStatuses)[number];