import React, { useCallback, useMemo, useState } from 'react'

type WidthProp = number | string

type BaseListProps<ItemData> = {
  height: number
  width: WidthProp
  itemCount: number
  itemSize: number
  itemData: ItemData
  children: (props: ListChildComponentProps<ItemData>) => React.ReactNode
  outerElementType?: React.ElementType<React.HTMLAttributes<any>>
  itemKey?: (index: number, data: ItemData) => React.Key
}

export type ListChildComponentProps<ItemData> = {
  index: number
  data: ItemData
  style: React.CSSProperties
}

const getWidthStyle = (width: WidthProp): React.CSSProperties['width'] =>
  typeof width === 'number' ? `${width}px` : width

export function FixedSizeList<ItemData>({
  height,
  width,
  itemCount,
  itemSize,
  itemData,
  children,
  outerElementType,
  itemKey,
}: BaseListProps<ItemData>): JSX.Element {
  const [scrollOffset, setScrollOffset] = useState(0)

  const totalHeight = itemCount * itemSize
  const startIndex = Math.max(0, Math.floor(scrollOffset / itemSize))
  const visibleCount = Math.ceil(height / itemSize) + 1
  const endIndex = Math.min(itemCount - 1, startIndex + visibleCount)

  const items = useMemo(() => {
    const childrenNodes: React.ReactNode[] = []
    for (let index = startIndex; index <= endIndex; index += 1) {
      const style: React.CSSProperties = {
        position: 'absolute',
        top: index * itemSize,
        left: 0,
        width: '100%',
        height: itemSize,
      }
      const rendered = children({ index, data: itemData, style })
      const key = itemKey ? itemKey(index, itemData) : index
      childrenNodes.push(<React.Fragment key={key}>{rendered}</React.Fragment>)
    }
    return childrenNodes
  }, [children, endIndex, itemData, itemKey, itemSize, startIndex])

  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollOffset(event.currentTarget.scrollTop)
  }, [])

  const Outer = outerElementType ?? 'div'

  const outerStyle: React.CSSProperties = {
    position: 'relative',
    overflowY: 'auto',
    overflowX: 'hidden',
    height,
    width: getWidthStyle(width),
    willChange: 'scroll-position',
  }

  const innerStyle: React.CSSProperties = {
    height: totalHeight,
    width: '100%',
    position: 'relative',
  }

  return (
    <Outer onScroll={handleScroll} style={outerStyle}>
      <div style={innerStyle}>{items}</div>
    </Outer>
  )
}
