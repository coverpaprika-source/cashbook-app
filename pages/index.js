import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import styles from '../styles/home.module.css'

const STORAGE_KEY = 'cashbook.entries.v1'
const CATEGORY_STORAGE_KEY = 'cashbook.categories.v1'

const DEFAULT_INCOME_CATEGORIES = ['กยศ.', 'พ่อให้', 'ปู่ให้', 'ย่าให้', 'ย่าแดงให้', 'อาให้']
const DEFAULT_EXPENSE_CATEGORIES = ['อาหาร', 'เดินทาง', 'หอพัก', 'สุขภาพ', 'บิล/ค่าใช้จ่าย', 'ของจำเป็น', 'บันเทิง', 'อื่นๆ']

function parseStoredCategories(value) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value)
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray(parsed.income) &&
      Array.isArray(parsed.expense)
    ) {
      return {
        income: parsed.income.length > 0 ? parsed.income : DEFAULT_INCOME_CATEGORIES,
        expense: parsed.expense.length > 0 ? parsed.expense : DEFAULT_EXPENSE_CATEGORIES,
      }
    }
  } catch {
    // ignore invalid data
  }

  return null
}

function loadCategories() {
  const stored = parseStoredCategories(window.localStorage.getItem(CATEGORY_STORAGE_KEY))
  return stored || {
    income: DEFAULT_INCOME_CATEGORIES,
    expense: DEFAULT_EXPENSE_CATEGORIES,
  }
}

const currencyFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
})

const monthFormatter = new Intl.DateTimeFormat('th-TH', {
  month: 'long',
  year: 'numeric',
})

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7)
}

function getMonthLabel(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  return monthFormatter.format(new Date(year, month - 1, 1))
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateValue}T00:00:00`))
}

function parseStoredEntries(value) {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function weekIndexFromDate(dateValue) {
  const day = Number(dateValue.slice(8, 10))
  return Math.min(4, Math.floor((day - 1) / 7))
}

function getWeekLabel(monthValue, weekIndex) {
  const [year, month] = monthValue.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const start = weekIndex * 7 + 1
  const end = weekIndex === 4 ? lastDay : Math.min(lastDay, start + 6)
  return `สัปดาห์ ${weekIndex + 1} (${start}-${end})`
}

function emptyForm(dateValue = todayValue()) {
  return {
    id: null,
    title: '',
    type: 'expense',
    category: DEFAULT_EXPENSE_CATEGORIES[0],
    amount: '',
    date: dateValue,
    note: '',
  }
}

function buildCategoryMatrix(entries, monthValue, categories, type) {
  const weeklyTotals = Array.from({ length: 5 }, () => 0)

  const rows = categories.map((category) => {
    const weeklyAmounts = Array.from({ length: 5 }, () => 0)

    entries.forEach((entry) => {
      if (entry.type !== type || entry.category !== category || entry.date.slice(0, 7) !== monthValue) {
        return
      }

      const weekIndex = weekIndexFromDate(entry.date)
      weeklyAmounts[weekIndex] += entry.amount
      weeklyTotals[weekIndex] += entry.amount
    })

    return {
      category,
      weeklyAmounts,
      total: weeklyAmounts.reduce((sum, amount) => sum + amount, 0),
    }
  })

  return {
    rows,
    weeklyTotals,
    total: weeklyTotals.reduce((sum, amount) => sum + amount, 0),
  }
}

function buildWeekGroups(entries, monthValue, selectedWeek) {
  const groups = Array.from({ length: 5 }, (_, weekIndex) => ({
    weekIndex,
    label: getWeekLabel(monthValue, weekIndex),
    entries: [],
  }))

  entries.forEach((entry) => {
    if (entry.date.slice(0, 7) !== monthValue) {
      return
    }

    groups[weekIndexFromDate(entry.date)].entries.push(entry)
  })

  groups.forEach((group) => {
    group.entries.sort((left, right) => right.date.localeCompare(left.date))
  })

  if (selectedWeek === 'all') {
    return groups.filter((group) => group.entries.length > 0)
  }

  const weekIndex = Number(selectedWeek)
  return groups.filter((group) => group.weekIndex === weekIndex)
}

function createRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawText(ctx, text, x, y, options = {}) {
  const { color = '#0f172a', font = '600 28px Inter, sans-serif', align = 'left' } = options

  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = align
  ctx.fillText(text, x, y)
}

function drawCompactTable(ctx, { x, y, width, title, matrix }) {
  const columnWidths = [240, 140, 140, 140, 140, 140, 126]
  const rowHeight = 46

  drawText(ctx, title, x, y - 18, {
    color: '#0f172a',
    font: '700 24px Inter, sans-serif',
  })

  createRoundedRect(ctx, x, y, width, 48, 16)
  ctx.fillStyle = '#0f172a'
  ctx.fill()

  const labels = ['หมวด', '1', '2', '3', '4', '5', 'รวม']
  let headerX = x + 14
  labels.forEach((label, index) => {
    drawText(ctx, label, headerX, y + 31, {
      color: '#f8fafc',
      font: '700 18px Inter, sans-serif',
    })
    headerX += columnWidths[index]
  })

  matrix.rows.forEach((row, index) => {
    const rowY = y + 48 + index * rowHeight
    createRoundedRect(ctx, x, rowY, width, 42, 14)
    ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8fafc'
    ctx.fill()

    let currentX = x + 14
    drawText(ctx, row.category, currentX, rowY + 27, {
      font: '600 18px Inter, sans-serif',
    })
    currentX += columnWidths[0]

    row.weeklyAmounts.forEach((amount, weekIndex) => {
      drawText(ctx, amount ? currencyFormatter.format(amount) : '-', currentX, rowY + 27, {
        color: amount ? '#0f172a' : '#94a3b8',
        font: '600 18px Inter, sans-serif',
      })
      currentX += columnWidths[weekIndex + 1]
    })

    drawText(ctx, currencyFormatter.format(row.total), currentX, rowY + 27, {
      color: '#1d4ed8',
      font: '700 18px Inter, sans-serif',
    })
  })

  const totalRowY = y + 48 + matrix.rows.length * rowHeight
  createRoundedRect(ctx, x, totalRowY, width, 42, 14)
  ctx.fillStyle = '#eff6ff'
  ctx.fill()

  let totalX = x + 14
  drawText(ctx, 'รวม', totalX, totalRowY + 27, {
    color: '#0f172a',
    font: '700 18px Inter, sans-serif',
  })
  totalX += columnWidths[0]

  matrix.weeklyTotals.forEach((amount, weekIndex) => {
    drawText(ctx, currencyFormatter.format(amount), totalX, totalRowY + 27, {
      color: '#0f172a',
      font: '700 18px Inter, sans-serif',
    })
    totalX += columnWidths[weekIndex + 1]
  })

  drawText(ctx, currencyFormatter.format(matrix.total), totalX, totalRowY + 27, {
    color: '#1d4ed8',
    font: '700 18px Inter, sans-serif',
  })
}

function drawSummaryImage({ monthLabel, totals, incomeMatrix, expenseMatrix, entryCount }) {
  const width = 1600
  const cardWidth = (width - 160) / 3
  const incomeTableHeight = 48 + (incomeMatrix.rows.length + 1) * 46 + 30
  const expenseTableHeight = 48 + (expenseMatrix.rows.length + 1) * 46 + 30
  const height = 520 + 180 + incomeTableHeight + expenseTableHeight + 40
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  ctx.scale(scale, scale)

  const background = ctx.createLinearGradient(0, 0, 0, height)
  background.addColorStop(0, '#f8fafc')
  background.addColorStop(1, '#eef2ff')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  const header = ctx.createLinearGradient(0, 0, width, 0)
  header.addColorStop(0, '#0f172a')
  header.addColorStop(0.55, '#1d4ed8')
  header.addColorStop(1, '#0ea5e9')
  createRoundedRect(ctx, 56, 56, width - 112, 220, 36)
  ctx.fillStyle = header
  ctx.fill()

  drawText(ctx, 'Cashbook Summary', 96, 132, {
    color: '#f8fafc',
    font: '700 52px Inter, sans-serif',
  })
  drawText(ctx, monthLabel, 96, 182, {
    color: '#dbeafe',
    font: '500 28px Inter, sans-serif',
  })
  drawText(ctx, `รายการทั้งหมด ${entryCount} รายการ`, 96, 232, {
    color: '#e0f2fe',
    font: '500 24px Inter, sans-serif',
  })

  const statY = 320
  const stats = [
    { label: 'รายรับ', value: currencyFormatter.format(totals.income), color: '#16a34a', accent: '#dcfce7' },
    { label: 'รายจ่าย', value: currencyFormatter.format(totals.expense), color: '#dc2626', accent: '#fee2e2' },
    {
      label: 'คงเหลือ',
      value: currencyFormatter.format(totals.balance),
      color: totals.balance >= 0 ? '#0f766e' : '#b91c1c',
      accent: totals.balance >= 0 ? '#ccfbf1' : '#fecaca',
    },
  ]

  stats.forEach((stat, index) => {
    const x = 56 + index * (cardWidth + 24)
    createRoundedRect(ctx, x, statY, cardWidth, 180, 28)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    createRoundedRect(ctx, x + 18, statY + 18, 118, 42, 20)
    ctx.fillStyle = stat.accent
    ctx.fill()
    drawText(ctx, stat.label, x + 36, statY + 47, {
      color: stat.color,
      font: '700 22px Inter, sans-serif',
    })
    drawText(ctx, stat.value, x + 28, statY + 124, {
      color: '#0f172a',
      font: '700 36px Inter, sans-serif',
    })
  })

  const tableWidth = width - 112
  drawCompactTable(ctx, {
    x: 56,
    y: 566,
    width: tableWidth,
    title: 'สรุปรายรับรายเดือน',
    matrix: incomeMatrix,
  })

  drawCompactTable(ctx, {
    x: 56,
    y: 566 + 48 + (incomeMatrix.rows.length + 1) * 46 + 38,
    width: tableWidth,
    title: 'สรุปรายจ่ายรายเดือน',
    matrix: expenseMatrix,
  })

  return canvas.toDataURL('image/png')
}

export default function Home() {
  const [entries, setEntries] = useState([])
  const [categories, setCategories] = useState({ income: [], expense: [] })
  const [form, setForm] = useState(() => emptyForm())
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue())
  const [selectedWeek, setSelectedWeek] = useState('all')
  const [exporting, setExporting] = useState(false)
  const [exportFileName, setExportFileName] = useState(`cashbook-${currentMonthValue()}`)
  const previousMonthRef = useRef(selectedMonth)

  useEffect(() => {
    const storedEntries = parseStoredEntries(window.localStorage.getItem(STORAGE_KEY))
    setEntries(storedEntries)
    setCategories(loadCategories())
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories))
  }, [categories])

  const availableMonths = useMemo(() => {
    const monthSet = new Set(entries.map((entry) => entry.date.slice(0, 7)))
    monthSet.add(currentMonthValue())
    return Array.from(monthSet).sort((left, right) => right.localeCompare(left))
  }, [entries])

  const monthEntries = useMemo(() => {
    return entries
      .filter((entry) => entry.date.slice(0, 7) === selectedMonth)
      .sort((left, right) => right.date.localeCompare(left.date))
  }, [entries, selectedMonth])

  const weekGroups = useMemo(() => {
    return buildWeekGroups(entries, selectedMonth, selectedWeek)
  }, [entries, selectedMonth, selectedWeek])

  const totals = useMemo(() => {
    return monthEntries.reduce(
      (accumulator, entry) => {
        if (entry.type === 'income') {
          accumulator.income += entry.amount
        } else {
          accumulator.expense += entry.amount
        }

        accumulator.balance = accumulator.income - accumulator.expense
        return accumulator
      },
      { income: 0, expense: 0, balance: 0 }
    )
  }, [monthEntries])

  const incomeMatrix = useMemo(() => buildCategoryMatrix(monthEntries, selectedMonth, categories.income, 'income'), [monthEntries, selectedMonth, categories])
  const expenseMatrix = useMemo(() => buildCategoryMatrix(monthEntries, selectedMonth, categories.expense, 'expense'), [monthEntries, selectedMonth, categories])
  const categoryOptions = form.type === 'income' ? categories.income : categories.expense
  const incomeShare = totals.income + totals.expense > 0 ? totals.income / (totals.income + totals.expense) : 0
  const chartBackground =
    totals.income + totals.expense > 0
      ? `conic-gradient(#16a34a 0turn ${incomeShare}turn, #dc2626 ${incomeShare}turn 1turn)`
      : 'conic-gradient(#cbd5e1 0turn 1turn)'

  useEffect(() => {
    if (categoryOptions.length > 0 && !categoryOptions.includes(form.category)) {
      setForm((current) => ({
        ...current,
        category: categoryOptions[0],
      }))
    }
  }, [categoryOptions, form.category])

  useEffect(() => {
    const previousDefault = `cashbook-${previousMonthRef.current}`
    const nextDefault = `cashbook-${selectedMonth}`

    setExportFileName((current) => (current === previousDefault ? nextDefault : current))
    previousMonthRef.current = selectedMonth
  }, [selectedMonth])

  function handleSubmit(event) {
    event.preventDefault()

    const amount = Number(form.amount)
    if (!form.date || !Number.isFinite(amount) || amount <= 0) {
      return
    }

    const entry = {
      id: form.id ?? crypto.randomUUID(),
      title: form.title.trim() || 'ไม่มีหัวข้อ',
      type: form.type,
      category: form.category,
      amount,
      date: form.date,
      note: form.note.trim(),
      createdAt: form.id ? entries.find((item) => item.id === form.id)?.createdAt ?? Date.now() : Date.now(),
    }

    setEntries((current) => {
      const filtered = current.filter((item) => item.id !== entry.id)
      return [entry, ...filtered].sort((left, right) => right.date.localeCompare(left.date))
    })
    setSelectedMonth(entry.date.slice(0, 7))
    setSelectedWeek('all')
    setForm(emptyForm(entry.date))
  }

  function handleEdit(entry) {
    setForm({
      id: entry.id,
      title: entry.title || '',
      type: entry.type,
      category: entry.category,
      amount: String(entry.amount),
      date: entry.date,
      note: entry.note ?? '',
    })
    setSelectedMonth(entry.date.slice(0, 7))
    setSelectedWeek('all')

    const target = document.getElementById('entry-form')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function handleDelete(id) {
    if (!window.confirm('ต้องการลบรายการนี้ใช่ไหม')) {
      return
    }

    setEntries((current) => current.filter((entry) => entry.id !== id))
    if (form.id === id) {
      setForm(emptyForm())
    }
  }

  function handleMonthChange(value) {
    setSelectedMonth(value)
    setSelectedWeek('all')
  }

  async function handleExportImage() {
    setExporting(true)
    try {
      const image = drawSummaryImage({
        monthLabel: getMonthLabel(selectedMonth),
        totals,
        incomeMatrix,
        expenseMatrix,
        entryCount: monthEntries.length,
      })

      if (!image) {
        return
      }

      const link = document.createElement('a')
      link.href = image
      link.download = `cashbook-${selectedMonth}.png`
      link.click()
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPDF() {
    setExporting(true)
    try {
      const image = drawSummaryImage({
        monthLabel: getMonthLabel(selectedMonth),
        totals,
        incomeMatrix,
        expenseMatrix,
        entryCount: monthEntries.length,
      })

      if (!image) {
        return
      }

      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' })
      const imageDimensions = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.width, height: img.height })
        img.onerror = reject
        img.src = image
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const ratio = Math.min(pdfWidth / imageDimensions.width, pdfHeight / imageDimensions.height)
      const imageWidth = imageDimensions.width * ratio
      const imageHeight = imageDimensions.height * ratio
      const offsetX = (pdfWidth - imageWidth) / 2
      const offsetY = (pdfHeight - imageHeight) / 2

      const filename = exportFileName.trim() || `cashbook-${selectedMonth}`
      pdf.addImage(image, 'PNG', offsetX, offsetY, imageWidth, imageHeight)
      pdf.save(`${filename}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const hasEntries = monthEntries.length > 0

  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Praifon</p>
          <h1>บันทึกรายรับรายจ่าย</h1>
          <p className={styles.heroText}>
            ดูสรุปเงินปัจจุบันของเดือนที่เลือกด้วยกราฟวงกลม และเปิดประวัติรายสัปดาห์ด้วยตัวกรองเดือนกับสัปดาห์แยกกันได้
          </p>
          <div className={styles.summaryPills}>
            <span>รายรับ {currencyFormatter.format(totals.income)}</span>
            <span>รายจ่าย {currencyFormatter.format(totals.expense)}</span>
            <span>คงเหลือ {currencyFormatter.format(totals.balance)}</span>
          </div>
        </div>

        <div className={styles.chartPanel}>
          <div className={styles.pieChart} style={{ background: chartBackground }}>
            <div className={styles.pieCenter}>
              <span>คงเหลือ</span>
              <strong>{currencyFormatter.format(totals.balance)}</strong>
            </div>
          </div>

          <div className={styles.chartLegend}>
            <div>
              <span className={styles.legendDotIncome} />
              <strong>รายรับ</strong>
              <span>{currencyFormatter.format(totals.income)}</span>
            </div>
            <div>
              <span className={styles.legendDotExpense} />
              <strong>รายจ่าย</strong>
              <span>{currencyFormatter.format(totals.expense)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card} id="entry-form">
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardLabel}>{form.id ? 'กำลังแก้ไขรายการ' : 'เพิ่มรายการใหม่'}</p>
              <h2>บันทึกรายการ</h2>
            </div>
            <button type="button" className={styles.ghostButton} onClick={() => setForm(emptyForm())}>
              ล้างฟอร์ม
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              หัวข้อรายการ
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="ใส่หัวข้อหรือเว้นว่างได้"
              />
            </label>

            <div className={styles.twoCol}>
              <label>
                ประเภท
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value,
                      category:
                        event.target.value === 'income'
                          ? categories.income[0] ?? ''
                          : categories.expense[0] ?? '',
                    }))
                  }
                >
                  <option value="expense">รายจ่าย</option>
                  <option value="income">รายรับ</option>
                </select>
              </label>

              <label>
                วันที่
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  required
                />
              </label>
            </div>

            <div className={styles.twoCol}>
              <label>
                หมวดหมู่
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                จำนวนเงิน
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0"
                  required
                />
              </label>
            </div>

            <label>
              หมายเหตุ
              <textarea
                rows="3"
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="ใส่รายละเอียดเพิ่มเติมได้"
              />
            </label>

            <button type="submit" className={styles.primaryButton}>
              {form.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
            </button>
          </form>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardLabel}>ประวัติ</p>
              <h2>ประวัติรายสัปดาห์</h2>
            </div>
            <div className={styles.headerControls}>
              <Link href="/categories" className={styles.ghostButton}>
                จัดการหมวดหมู่
              </Link>
              <select
                className={styles.monthSelect}
                value={selectedMonth}
                onChange={(event) => handleMonthChange(event.target.value)}
              >
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {getMonthLabel(month)}
                  </option>
                ))}
              </select>
              <label>
                ชื่อไฟล์ PDF
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(event) => setExportFileName(event.target.value)}
                  placeholder="cashbook-2026-06"
                  disabled={exporting}
                  className={styles.monthSelect}
                />
              </label>
              <select
                className={styles.weekSelect}
                value={selectedWeek}
                onChange={(event) => setSelectedWeek(event.target.value)}
              >
                <option value="all">ทุกสัปดาห์</option>
                <option value="0">สัปดาห์ 1</option>
                <option value="1">สัปดาห์ 2</option>
                <option value="2">สัปดาห์ 3</option>
                <option value="3">สัปดาห์ 4</option>
                <option value="4">สัปดาห์ 5</option>
              </select>
              <button type="button" className={styles.secondaryButton} onClick={handleExportImage} disabled={exporting}>
                {exporting ? 'กำลังสร้างภาพ...' : 'ดาวน์โหลดรูปสรุป'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleExportPDF} disabled={exporting}>
                {exporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
              </button>
            </div>
          </div>

          <p className={styles.helperText}>
            ใช้ตัวกรองเดือนและสัปดาห์แยกกันเพื่อดูรายการย้อนหลังแบบรายสัปดาห์ และไฟล์ดาวน์โหลดจะสรุปเป็นตารางรายเดือนแยกตามอาทิตย์และหมวดหมู่
          </p>

          <div className={styles.historyList}>
            {hasEntries ? (
              weekGroups.map((group) => (
                <section key={group.weekIndex} className={styles.weekGroup}>
                  <div className={styles.weekGroupHeader}>
                    <h3>{group.label}</h3>
                    <span>{group.entries.length} รายการ</span>
                  </div>

                  <div className={styles.weekGroupList}>
                    {group.entries.map((entry) => (
                      <article key={entry.id} className={styles.historyItem}>
                        <div>
                          <div className={styles.historyTopRow}>
                            <strong>{entry.title || 'ไม่มีหัวข้อ'}</strong>
                            <span className={entry.type === 'income' ? styles.pillIncome : styles.pillExpense}>
                              {entry.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                            </span>
                          </div>
                          <p className={styles.historyMeta}>
                            {formatDate(entry.date)} · {entry.category}
                          </p>
                          {entry.note ? <p className={styles.historyNote}>{entry.note}</p> : null}
                        </div>

                        <div className={styles.historyActions}>
                          <strong className={entry.type === 'income' ? styles.positive : styles.negative}>
                            {currencyFormatter.format(entry.amount)}
                          </strong>
                          <div className={styles.actionRow}>
                            <button type="button" className={styles.ghostButton} onClick={() => handleEdit(entry)}>
                              แก้ไข
                            </button>
                            <button type="button" className={styles.dangerButton} onClick={() => handleDelete(entry.id)}>
                              ลบ
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className={styles.emptyState}>
                <h3>ยังไม่มีข้อมูลเดือนนี้</h3>
                <p>เพิ่มรายการแรกเพื่อเริ่มสรุปยอดและดาวน์โหลดภาพสรุปได้ทันที</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  )
}
