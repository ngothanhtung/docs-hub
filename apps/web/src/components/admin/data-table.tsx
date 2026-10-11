'use client';

import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns3Icon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface TableView<T> {
  value: string;
  label: string;
  filter: (row: T) => boolean;
}

/**
 * Bảng dữ liệu cho trang quản trị, bố cục theo data-table của dashboard-01:
 * tab lọc nhanh có đếm số, tìm kiếm, ẩn/hiện cột, sắp xếp, chọn nhiều dòng để thao tác hàng loạt,
 * phân trang với số dòng mỗi trang.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  views,
  search,
  columnLabels,
  toolbar,
  bulkActions,
  emptyText = 'Không có dữ liệu.',
  initialSorting = [],
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId: (row: T) => string;
  views?: TableView<T>[];
  search?: { placeholder: string; match: (row: T, query: string) => boolean };
  /** Tên hiển thị của cột trong menu "Cột". */
  columnLabels?: Record<string, string>;
  toolbar?: ReactNode;
  bulkActions?: (rows: T[], clear: () => void) => ReactNode;
  emptyText?: string;
  initialSorting?: SortingState;
}) {
  const [view, setView] = useState(views?.[0]?.value ?? 'all');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const activeView = views?.find((v) => v.value === view);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((row) => (!activeView || activeView.filter(row)) && (!q || !search || search.match(row, q)));
  }, [data, activeView, query, search]);

  const selectable = bulkActions !== undefined;
  const allColumns = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      selectable
        ? [
            {
              id: 'select',
              header: ({ table }) => (
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Chọn tất cả dòng trên trang"
                  />
                </div>
              ),
              cell: ({ row }) => (
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={row.getIsSelected()}
                    disabled={!row.getCanSelect()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Chọn dòng"
                  />
                </div>
              ),
              enableSorting: false,
              enableHiding: false,
            },
            ...columns,
          ]
        : columns,
    [columns, selectable],
  );

  const table = useReactTable({
    data: rows,
    columns: allColumns,
    getRowId,
    state: { sorting, rowSelection, columnVisibility, pagination },
    enableRowSelection: selectable,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const clearSelection = () => setRowSelection({});
  const changeView = (value: string) => {
    setView(value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    clearSelection();
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
        {views ? (
          <>
            <NativeSelect
              aria-label="Nhóm"
              value={view}
              onChange={(e) => changeView(e.target.value)}
              className="w-fit @4xl/main:hidden"
            >
              {views.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label} ({data.filter(v.filter).length})
                </option>
              ))}
            </NativeSelect>
            <Tabs value={view} onValueChange={(v) => changeView(String(v))} className="hidden @4xl/main:flex">
              <TabsList className="**:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1">
                {views.map((v) => (
                  <TabsTrigger key={v.value} value={v.value}>
                    {v.label} <Badge variant="secondary">{data.filter(v.filter).length}</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {search ? (
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                className="h-8 w-56 pl-8"
              />
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3Icon data-icon="inline-start" />
              Cột
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Hiện cột</DropdownMenuLabel>
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {columnLabels?.[column.id] ?? column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {toolbar}
        </div>
      </div>

      {selected.length > 0 && bulkActions ? (
        <div className="mx-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm lg:mx-6">
          <span className="font-medium">Đã chọn {selected.length}</span>
          <div className="flex flex-wrap items-center gap-2">{bulkActions(selected, clearSelection)}</div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={clearSelection}>
            <XIcon /> Bỏ chọn
          </Button>
        </div>
      ) : null}

      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan} className={cn(header.column.id === 'select' && 'w-8')}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center text-muted-foreground">
                    {emptyText}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {selectable
              ? `Đã chọn ${selected.length} / ${rows.length} dòng.`
              : `${rows.length.toLocaleString('vi-VN')} dòng.`}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Số dòng mỗi trang
              </Label>
              <NativeSelect
                id="rows-per-page"
                value={pagination.pageSize}
                onChange={(e) => setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}
                className="w-20"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Trang {table.getPageCount() === 0 ? 0 : pagination.pageIndex + 1} / {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Trang đầu</span>
                <ChevronsLeftIcon />
              </Button>
              <Button variant="outline" className="size-8" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">Trang trước</span>
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" className="size-8" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <span className="sr-only">Trang sau</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Trang cuối</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tiêu đề cột bấm được để sắp xếp. */
export function SortHeader<T>({ column, title, className }: { column: Column<T, unknown>; title: string; className?: string }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === 'asc' ? ArrowUpIcon : sorted === 'desc' ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('-ml-2 h-8 data-[sorted=true]:text-foreground', className)}
      data-sorted={Boolean(sorted)}
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {title}
      <Icon className="size-3.5 text-muted-foreground" />
    </Button>
  );
}
