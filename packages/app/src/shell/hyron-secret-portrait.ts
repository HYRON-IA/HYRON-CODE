/** HYRONCODE V1.3 — prioridade dos retratos dos 12 personagens secretos.
 * O SVG distribuído com o aplicativo é o avatar de segurança, nunca é removido.
 * A imagem privada do usuário só é consultada quando o personagem foi desbloqueado na busca.
 */
export function resolveSecretPortrait(input: {
  readonly defaultAvatar: string
  readonly thumbnail?: string
  readonly link?: string
  readonly hidden?: boolean
  readonly broken?: boolean
}): string {
  if (input.hidden || input.broken) return input.defaultAvatar
  return input.thumbnail || input.link || input.defaultAvatar
}

/** Exibe a restauração apenas se houve personalização do retrato secreto. */
export function hasSecretPortraitOverride(input: {
  readonly uploaded?: boolean
  readonly link?: string
}): boolean {
  return Boolean(input.uploaded || input.link)
}
