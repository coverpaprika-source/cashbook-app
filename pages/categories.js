import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from '../styles/home.module.css'

const STORAGE_KEY = 'cashbook.entries.v1'
const CATEGORY_STORAGE_KEY = 'cashbook.categories.v1'

const DEFAULT_INCOME_CATEGORIES = ['กยศ.', 'พ่อให้', 'ปู่ให้', 'ย่าให้', 'ย่าแดงให้', 'อาให้']
const DEFAULT_EXPENSE_CATEGORIES = ['อาหาร', 'เดินทาง', 'หอพัก', 'สุขภาพ', 'บิล/ค่าใช้จ่าย', 'ของจำเป็น', 'บันเทิง', 'อื่นๆ']

function parseStoredCategories(value) {
  if (!value) return null

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

function parseStoredEntries(value) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function CategorySettings() {
  const [categories, setCategories] = useState({ income: DEFAULT_INCOME_CATEGORIES, expense: DEFAULT_EXPENSE_CATEGORIES })
  const [entries, setEntries] = useState([])
  const [selectedType, setSelectedType] = useState('expense')
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    setCategories(parseStoredCategories(window.localStorage.getItem(CATEGORY_STORAGE_KEY)) || {
      income: DEFAULT_INCOME_CATEGORIES,
      expense: DEFAULT_EXPENSE_CATEGORIES,
    })
    setEntries(parseStoredEntries(window.localStorage.getItem(STORAGE_KEY)))
  }, [])

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories))
  }, [categories])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const categoryOptions = categories[selectedType]
  const affectedItems = entries.filter((entry) => entry.type === selectedType)

  function handleAddCategory(event) {
    event.preventDefault()
    const trimmed = newCategory.trim()
    if (!trimmed) {
      return
    }

    if (categoryOptions.includes(trimmed)) {
      window.alert('หมวดหมู่นี้มีอยู่แล้ว')
      return
    }

    setCategories((current) => ({
      ...current,
      [selectedType]: [...current[selectedType], trimmed],
    }))
    setNewCategory('')
  }

  function handleDeleteCategory(category) {
    if (categoryOptions.length === 1) {
      window.alert('ต้องมีหมวดหมู่อย่างน้อยหนึ่งหมวดสำหรับประเภทนี้')
      return
    }

    if (!window.confirm(`ลบหมวดหมู่ "${category}" ใช่หรือไม่? รายการที่ใช้หมวดนี้จะถูกย้ายไปยังหมวดใหม่.`)) {
      return
    }

    const nextCategories = categoryOptions.filter((item) => item !== category)
    setCategories((current) => ({
      ...current,
      [selectedType]: nextCategories,
    }))

    setEntries((current) =>
      current.map((entry) => {
        if (entry.type === selectedType && entry.category === category) {
          return {
            ...entry,
            category: nextCategories[0],
          }
        }
        return entry
      })
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Praifon</p>
          <h1>ตั้งค่าหมวดหมู่</h1>
          <p className={styles.heroText}>
            เพิ่ม-ลบหมวดหมู่รายรับและรายจ่ายแยกจากหน้าบันทึกหลักได้ เพื่อให้การจัดการหมวดหมู่สะดวกขึ้น
          </p>
          <div className={styles.summaryPills}>
            <span>หมวดรายรับ {categories.income.length} รายการ</span>
            <span>หมวดรายจ่าย {categories.expense.length} รายการ</span>
          </div>
        </div>

        <div className={styles.chartPanel}>
          <div>
            <p className={styles.cardLabel}>คำแนะนำ</p>
            <p className={styles.helperText}>
              หมวดหมู่ที่เพิ่มจะถูกนำมาใช้ทันทีในหน้าเพิ่มรายการ เมื่อกลับไปที่หน้าหลัก
            </p>
          </div>
          <Link href="/" className={styles.primaryButton}>
            กลับหน้าหลัก
          </Link>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.cardLabel}>หมวดหมู่</p>
            <h2>จัดการหมวดหมู่</h2>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleAddCategory}>
          <div className={styles.twoCol}>
            <label>
              ประเภทหมวดหมู่
              <select
                className={styles.monthSelect}
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
              >
                <option value="expense">รายจ่าย</option>
                <option value="income">รายรับ</option>
              </select>
            </label>

            <label>
              ชื่อหมวดหมู่ใหม่
              <input
                type="text"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="เพิ่มหมวดใหม่"
              />
            </label>
          </div>

          <button type="submit" className={styles.primaryButton}>
            เพิ่มหมวดหมู่
          </button>
        </form>

        <div className={styles.historyList}>
          {categoryOptions.map((category) => (
            <article key={category} className={styles.historyItem}>
              <div>
                <div className={styles.historyTopRow}>
                  <strong>{category}</strong>
                </div>
                <p className={styles.historyMeta}>
                  {entries.filter((entry) => entry.category === category && entry.type === selectedType).length} รายการ
                </p>
              </div>
              <div className={styles.historyActions}>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => handleDeleteCategory(category)}
                >
                  ลบ
                </button>
              </div>
            </article>
          ))}
        </div>

        <p className={styles.helperText}>
          หมวดหมู่หลักจะถูกบันทึกในเบราว์เซอร์ของคุณ และจะยังอยู่เมื่อกลับไปใช้ในหน้าหลัก
        </p>
      </section>
    </main>
  )
}
