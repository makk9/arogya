export type AgentErrorCode =
  | "timeout"
  | "rate_limit"
  | "parse_failure"
  | "context_overflow"
  | "unknown";

export class AgentError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    public readonly agentName: string,
    public readonly recoverable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "AgentError";
  }
}
