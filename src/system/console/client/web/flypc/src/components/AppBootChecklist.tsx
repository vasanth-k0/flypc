import React from 'react'
import { Spin } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, LoadingOutlined } from '@ant-design/icons'

export type BootStep = {
  id: string
  label: string
  state: 'pending' | 'active' | 'done' | 'failed'
  detail?: string
}

type AppBootChecklistProps = {
  appName: string
  steps: BootStep[]
  failed: boolean
}

const StepIcon: React.FC<{ state: BootStep['state'] }> = ({ state }) => {
  if (state === 'done') {
    return <CheckCircleFilled style={{ color: '#16a34a' }} />
  }

  if (state === 'failed') {
    return <CloseCircleFilled style={{ color: '#dc2626' }} />
  }

  if (state === 'active') {
    return <LoadingOutlined spin style={{ color: '#597ef7' }} />
  }

  return <span className="app-boot__pending-dot" aria-hidden="true" />
}

export const AppBootChecklist: React.FC<AppBootChecklistProps> = ({ appName, steps, failed }) => (
  <div className="app-boot">
    <Spin indicator={<LoadingOutlined spin />} size="large" />
    <h3 className="app-boot__title">{failed ? `Unable to start ${appName}` : `Starting ${appName}`}</h3>
    <ul className="app-boot__steps">
      {steps.map((step) => (
        <li key={step.id} className={`app-boot__step app-boot__step--${step.state}`}>
          <StepIcon state={step.state} />
          <div className="app-boot__step-body">
            <span>{step.label}</span>
            {step.detail ? <small>{step.detail}</small> : null}
          </div>
        </li>
      ))}
    </ul>
  </div>
)
