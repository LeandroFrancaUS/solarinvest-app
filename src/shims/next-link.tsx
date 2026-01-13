import type { AnchorHTMLAttributes, PropsWithChildren } from 'react'

type LinkProps = PropsWithChildren<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string | URL }
>

export default function Link({ href, children, ...rest }: LinkProps) {
  const resolvedHref = typeof href === 'string' ? href : href.toString()
  return (
    <a href={resolvedHref} {...rest}>
      {children}
    </a>
  )
}
