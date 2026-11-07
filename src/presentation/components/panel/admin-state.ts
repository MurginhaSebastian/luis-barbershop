/** Resultado de guardar algo en el panel, tal como lo muestra la pantalla. */
export interface AdminState {
  ok?: string;
  /** Se guardó, pero hay algo que el barbero debe revisar. */
  warning?: string;
  error?: string;
}

export type AdminAction = (prev: AdminState, form: FormData) => Promise<AdminState>;
