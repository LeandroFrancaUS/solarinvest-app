import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrintLayout } from '../PrintLayout'
import { BentoCard, BentoCardTitle, BentoCardContent } from '../BentoCard'

describe('Bento Grid Components', () => {
  describe('PrintLayout', () => {
    it('renders with correct structure', () => {
      const html = renderToStaticMarkup(
        <PrintLayout>
          <div>Test Content</div>
        </PrintLayout>
      )
      
      expect(html).toContain('data-testid="print-layout"')
      expect(html).toContain('Test Content')
    })

    it('applies custom className', () => {
      const html = renderToStaticMarkup(
        <PrintLayout className="custom-class">
          <div>Test</div>
        </PrintLayout>
      )
      
      expect(html).toContain('custom-class')
    })
  })

  describe('BentoCard', () => {
    it('renders default card', () => {
      const html = renderToStaticMarkup(
        <BentoCard>
          <p>Card Content</p>
        </BentoCard>
      )
      
      expect(html).toContain('data-testid="bento-card"')
      expect(html).toContain('Card Content')
      expect(html).toContain('col-span-12') // default span
    })

    it('renders highlight variant', () => {
      const html = renderToStaticMarkup(
        <BentoCard variant="highlight">
          <p>Highlighted</p>
        </BentoCard>
      )
      
      expect(html).toContain('bg-solar-brand')
      expect(html).toContain('Highlighted')
    })

    it('renders dark variant', () => {
      const html = renderToStaticMarkup(
        <BentoCard variant="dark">
          <p>Dark Card</p>
        </BentoCard>
      )
      
      expect(html).toContain('bg-solar-dark')
      expect(html).toContain('Dark Card')
    })

    it('applies custom column span', () => {
      const html = renderToStaticMarkup(
        <BentoCard colSpan="col-span-6">
          <p>Half Width</p>
        </BentoCard>
      )
      
      expect(html).toContain('col-span-6')
    })
  })

  describe('BentoCardTitle', () => {
    it('renders title with correct styling', () => {
      const html = renderToStaticMarkup(
        <BentoCardTitle>Test Title</BentoCardTitle>
      )
      
      expect(html).toContain('Test Title')
      expect(html).toContain('font-bold')
      expect(html).toContain('text-slate-800')
    })
  })

  describe('BentoCardContent', () => {
    it('renders content with correct styling', () => {
      const html = renderToStaticMarkup(
        <BentoCardContent>Test Content</BentoCardContent>
      )
      
      expect(html).toContain('Test Content')
      expect(html).toContain('text-slate-600')
      expect(html).toContain('text-sm')
    })
  })

  describe('Integration', () => {
    it('renders complete Bento Grid layout', () => {
      const html = renderToStaticMarkup(
        <PrintLayout>
          <BentoCard colSpan="col-span-12" variant="highlight">
            <BentoCardTitle>Main Title</BentoCardTitle>
            <BentoCardContent>Main content goes here</BentoCardContent>
          </BentoCard>
          
          <BentoCard colSpan="col-span-6">
            <BentoCardTitle>Left Card</BentoCardTitle>
            <BentoCardContent>Left content</BentoCardContent>
          </BentoCard>
          
          <BentoCard colSpan="col-span-6">
            <BentoCardTitle>Right Card</BentoCardTitle>
            <BentoCardContent>Right content</BentoCardContent>
          </BentoCard>
        </PrintLayout>
      )
      
      expect(html).toContain('data-testid="print-layout"')
      expect(html).toContain('Main Title')
      expect(html).toContain('Left Card')
      expect(html).toContain('Right Card')
      expect(html).toContain('bg-solar-brand')
    })
  })
})
