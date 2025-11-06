import * as React from 'react'

export interface SidebarItem {
  id: string
  label: string
  icon?: React.ReactNode
  onSelect?: () => void
  items?: SidebarItem[]
  disabled?: boolean
  title?: string
}

export interface SidebarGroup {
  id: string
  label: string
  items: SidebarItem[]
}

export interface SidebarProps {
  collapsed?: boolean
  mobileOpen?: boolean
  groups: SidebarGroup[]
  activeItemId?: string
  onNavigate?: () => void
  onCollapseToggle?: () => void
  onCloseMobile?: () => void
}

export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  groups,
  activeItemId,
  onNavigate,
  onCollapseToggle,
  onCloseMobile,
}: SidebarProps) {
  const parentIds = React.useMemo(() => {
    const activeParents = new Set<string>()
    const visit = (item: SidebarItem, trail: string[]) => {
      if (item.id === activeItemId) {
        trail.forEach((value) => activeParents.add(value))
      }
      item.items?.forEach((child) => visit(child, [...trail, item.id]))
    }

    groups.forEach((group) => {
      group.items.forEach((item) => visit(item, []))
    })

    return activeParents
  }, [activeItemId, groups])

  const [openSubmenus, setOpenSubmenus] = React.useState<Set<string>>(() => new Set(parentIds))
  const storedSubmenusRef = React.useRef<Set<string>>(new Set(parentIds))
  const openSubmenusRef = React.useRef(openSubmenus)

  React.useEffect(() => {
    openSubmenusRef.current = openSubmenus
    if (!collapsed) {
      storedSubmenusRef.current = new Set(openSubmenus)
    }
  }, [collapsed, openSubmenus])

  React.useEffect(() => {
    if (collapsed) {
      return
    }

    setOpenSubmenus((previous) => {
      const merged = new Set(previous)
      parentIds.forEach((id) => merged.add(id))
      return merged
    })
  }, [collapsed, parentIds])

  React.useEffect(() => {
    if (collapsed) {
      if (openSubmenusRef.current.size > 0) {
        storedSubmenusRef.current = new Set(openSubmenusRef.current)
        setOpenSubmenus(new Set())
      }
      return
    }

    setOpenSubmenus(() => {
      const restored = new Set(storedSubmenusRef.current)
      parentIds.forEach((id) => restored.add(id))
      return restored
    })
  }, [collapsed, parentIds])

  const toggleSubmenu = React.useCallback(
    (id: string) => {
      if (collapsed) {
        return
      }

      setOpenSubmenus((previous) => {
        const next = new Set(previous)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    },
    [collapsed],
  )

  const handleSelect = React.useCallback(
    (item: SidebarItem) => {
      item.onSelect?.()
      onNavigate?.()
      if (mobileOpen) {
        onCloseMobile?.()
      }
    },
    [mobileOpen, onCloseMobile, onNavigate],
  )

  const classes = ['sidebar']
  if (collapsed) {
    classes.push('collapsed')
  }
  if (mobileOpen) {
    classes.push('open')
  }

  const renderItem = (item: SidebarItem, level: number): React.ReactNode => {
    const hasChildren = item.items && item.items.length > 0
    const isExpanded = hasChildren && openSubmenus.has(item.id)
    const isActive = item.id === activeItemId
    const isDisabled = Boolean(item.disabled)

    const commonProps = {
      className: `sidebar-link${isActive ? ' active' : ''}${hasChildren ? ' has-children' : ''}${
        isDisabled ? ' is-disabled' : ''
      }`,
      title: item.title ?? (collapsed ? item.label : undefined),
      'aria-label': collapsed ? item.label : undefined,
    }

    if (hasChildren) {
      const submenuId = `${item.id}-submenu`
      return (
        <div key={item.id} className={`sidebar-item level-${level}`}>
          <button
            type="button"
            {...commonProps}
            onClick={() => toggleSubmenu(item.id)}
            aria-expanded={isExpanded}
            aria-controls={submenuId}
            disabled={collapsed}
          >
            <span className="icon" aria-hidden="true">
              {item.icon ?? '▾'}
            </span>
            <span className="sidebar-label">{item.label}</span>
            <span className="sidebar-chevron" aria-hidden="true">
              {isExpanded ? '▾' : '▸'}
            </span>
            {collapsed ? (
              <span className="tooltip" role="tooltip">
                {item.label}
              </span>
            ) : null}
          </button>
          <div id={submenuId} className={`sidebar-submenu${isExpanded ? ' expanded' : ''}`} role="group">
            {item.items?.map((child) => renderItem(child, level + 1))}
          </div>
        </div>
      )
    }

    return (
      <div key={item.id} className={`sidebar-item level-${level}`}>
        <button
          type="button"
          {...commonProps}
          onClick={() => handleSelect(item)}
          aria-current={isActive ? 'page' : undefined}
          disabled={isDisabled}
        >
          <span className="icon" aria-hidden="true">
            {item.icon ?? '•'}
          </span>
          <span className="sidebar-label">{item.label}</span>
          {collapsed ? (
            <span className="tooltip" role="tooltip">
              {item.label}
            </span>
          ) : null}
        </button>
      </div>
    )
  }

  return (
    <aside className={classes.join(' ')} aria-label="Navegação principal">
      <nav>
        {groups.map((group) => (
          <div key={group.id} className="sidebar-group">
            <div className="group">{group.label}</div>
            <div className="sidebar-group-items">{group.items.map((item) => renderItem(item, 0))}</div>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        {onCollapseToggle ? (
          <button
            type="button"
            className="sidebar-collapse"
            onClick={onCollapseToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <span aria-hidden="true">{collapsed ? '⤢' : '⤡'}</span>
            <span className="sidebar-label">{collapsed ? 'Expandir menu' : 'Recolher menu'}</span>
            {collapsed ? (
              <span className="tooltip" role="tooltip">
                {collapsed ? 'Expandir menu' : 'Recolher menu'}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>
    </aside>
  )
}
