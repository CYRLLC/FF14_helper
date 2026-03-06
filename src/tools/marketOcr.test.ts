import { describe, expect, it } from 'vitest'
import { applyOcrRowsToWorkbook, extractRowsFromOcrText } from './marketOcr'

describe('marketOcr helpers', () => {
  it('extracts rows from OCR text', () => {
    const parsed = extractRowsFromOcrText('靈砂油 3 12,500\n匠人藥水 8,800\n雜訊')

    expect(parsed).toEqual([
      {
        itemName: '靈砂油',
        price: 12500,
        quantity: 3,
      },
      {
        itemName: '匠人藥水',
        price: 8800,
        quantity: 1,
      },
    ])
  })

  it('merges OCR rows into the workbook', () => {
    const nextRows = applyOcrRowsToWorkbook({
      existingRows: [
        {
          id: 'row-1',
          itemName: '靈砂油',
          chocoboPrice: 0,
          mooglePrice: 13000,
          quantity: 2,
          note: '',
        },
      ],
      parsedRows: [
        {
          itemName: '靈砂油',
          price: 12500,
          quantity: 3,
        },
      ],
      targetServer: 'chocobo',
      mergeExistingRows: true,
      createRowId: () => 'row-new',
    })

    expect(nextRows).toHaveLength(1)
    expect(nextRows[0]).toMatchObject({
      itemName: '靈砂油',
      chocoboPrice: 12500,
      mooglePrice: 13000,
      quantity: 3,
    })
  })
})
