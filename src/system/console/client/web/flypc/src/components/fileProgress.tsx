import React from 'react'
import { Progress, notification } from 'antd'

type ProgressReporter = (percent: number, detail?: string) => void

export const runWithProgress = async (
  title: string,
  totalSteps: number,
  work: (report: ProgressReporter, step: (label?: string) => void) => Promise<void>,
): Promise<void> => {
  const key = `file-progress-${Date.now()}`
  let completedSteps = 0

  const render = (percent: number, detail?: string): void => {
    notification.open({
      key,
      message: title,
      description: (
        <div>
          {detail ? <div style={{ marginBottom: 8 }}>{detail}</div> : null}
          <Progress percent={percent} size="small" status="active" />
        </div>
      ),
      duration: 0,
      placement: 'bottomRight',
    })
  }

  render(0)

  try {
    await work(
      (percent, detail) => render(Math.min(100, Math.max(0, Math.round(percent))), detail),
      (label) => {
        completedSteps += 1
        const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100
        render(percent, label)
      },
    )

    notification.success({
      key,
      message: title,
      description: 'Completed',
      duration: 3,
      placement: 'bottomRight',
    })
  } catch (error) {
    notification.error({
      key,
      message: title,
      description: error instanceof Error ? error.message : 'Operation failed',
      duration: 5,
      placement: 'bottomRight',
    })
    throw error
  }
}
