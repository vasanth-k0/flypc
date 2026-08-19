import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { message } from 'antd'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.tsx'
import { store } from './store'

message.config({
  top: 12,
  duration: 2,
  maxCount: 4,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
