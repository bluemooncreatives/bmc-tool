import { useState } from 'react'
import { ChevronDown, ChevronRight, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AccountStatusBadge,
  RoleBadge,
  StatTile,
} from '../components/shared'
import { type OrgChart, type OrgChartNode } from '../data/types'

function ChartNode({
  node,
  depth,
  collapsed,
  onToggle,
}: {
  node: OrgChartNode
  depth: number
  collapsed: Set<string>
  onToggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(node.id)

  return (
    <li className='min-w-0'>
      <div
        className={cn(
          'flex min-w-0 items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50',
          depth === 0 && 'border-primary/40 bg-primary/5'
        )}
      >
        {hasChildren ? (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-6 shrink-0'
            aria-label={
              isCollapsed
                ? `Expand reports of ${node.name}`
                : `Collapse reports of ${node.name}`
            }
            aria-expanded={!isCollapsed}
            onClick={() => onToggle(node.id)}
          >
            {isCollapsed ? <ChevronRight /> : <ChevronDown />}
          </Button>
        ) : (
          <span className='size-6 shrink-0' />
        )}

        <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-muted'>
          <User className='size-4' />
        </span>

        <span className='min-w-0 flex-1'>
          <span className='block truncate text-sm font-medium'>
            {node.name}
          </span>
          <span className='block truncate text-xs text-muted-foreground'>
            {[node.designationTitle, node.jobTitle, node.departmentName]
              .filter(Boolean)
              .join(' · ') || node.email}
          </span>
        </span>

        <span className='flex shrink-0 items-center gap-2'>
          {node.totalReports > 0 && (
            <Badge variant='outline'>
              {node.totalReports} report{node.totalReports === 1 ? '' : 's'}
            </Badge>
          )}
          <RoleBadge role={node.role} />
          <AccountStatusBadge status={node.status} />
        </span>
      </div>

      {hasChildren && !isCollapsed && (
        <ul className='mt-2 ms-4 space-y-2 border-s ps-4'>
          {node.children.map((child) => (
            <ChartNode
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Reporting tree for the selected organization. The tree is assembled on the
 * server, including cycle protection, so this only has to render it.
 */
export function OrgChartTab({
  chart,
  isLoading,
}: {
  chart: OrgChart | null
  isLoading: boolean
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className='h-14 w-full' />
        ))}
      </div>
    )
  }

  if (!chart || chart.totals.accounts === 0) {
    return (
      <p className='rounded-lg border py-12 text-center text-sm text-muted-foreground'>
        This organization has no accounts yet.
      </p>
    )
  }

  return (
    <div className='space-y-5'>
      <div className='grid gap-3 @2xl/content:grid-cols-5'>
        <StatTile label='Accounts' value={chart.totals.accounts} />
        <StatTile label='Active' value={chart.totals.active} />
        <StatTile label='Administrators' value={chart.totals.admins} />
        <StatTile
          label='Top level'
          value={chart.totals.withoutManager}
          hint='Accounts with no manager'
        />
        <StatTile label='Depth' value={chart.totals.maxDepth} />
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => setCollapsed(new Set())}
        >
          Expand all
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => {
            const ids = new Set<string>()
            const walk = (nodes: OrgChartNode[]) => {
              for (const node of nodes) {
                if (node.children.length > 0) {
                  ids.add(node.id)
                  walk(node.children)
                }
              }
            }
            walk([...chart.roots, ...chart.detached])
            setCollapsed(ids)
          }}
        >
          Collapse all
        </Button>
      </div>

      <ul className='space-y-2'>
        {chart.roots.map((node) => (
          <ChartNode
            key={node.id}
            node={node}
            depth={0}
            collapsed={collapsed}
            onToggle={toggle}
          />
        ))}
      </ul>

      {chart.detached.length > 0 && (
        <section className='space-y-2 border-t pt-5'>
          <h3 className='text-sm font-medium'>Detached accounts</h3>
          <p className='text-xs text-muted-foreground'>
            Their manager is no longer in this organization. Give them a new
            manager from Account Control to put them back on the chart.
          </p>
          <ul className='space-y-2'>
            {chart.detached.map((node) => (
              <ChartNode
                key={node.id}
                node={node}
                depth={0}
                collapsed={collapsed}
                onToggle={toggle}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
