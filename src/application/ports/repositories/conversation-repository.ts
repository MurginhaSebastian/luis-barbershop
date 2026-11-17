/** Un turno de la conversación con el asistente de IA: lo que escribió el cliente o lo que le respondió. */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface IConversationRepository {
  /** Los últimos `limit` turnos de ese celular desde `since`, del más antiguo al más nuevo. */
  recent(phone: string, since: Date, limit: number): Promise<ConversationTurn[]>;
  /** Guarda los turnos en orden y borra los de cualquier celular anteriores a `forgetBefore`. */
  append(phone: string, turns: readonly ConversationTurn[], at: Date, forgetBefore: Date): Promise<void>;
}
