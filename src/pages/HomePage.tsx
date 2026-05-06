import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Card from '../components/Card'
import Button from '../components/Button'

export default function HomePage() {
  const [name, setName] = useState('')
  const [greetMsg, setGreetMsg] = useState('')

  const greet = async () => {
    const msg = await invoke<string>('greet', { name })
    setGreetMsg(msg)
  }

  return (
    <div className="flex-1 flex justify-center pt-28 p-10">
      <div className="space-y-8 w-80">
        <div className="flex justify-center">
          <h1 className="font-bold text-3xl">Welcome</h1>
        </div>
        <Card className="space-y-4">
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter a name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && greet()}
          />
          <Button variant="green" full onClick={greet}>
            Greet
          </Button>
          {greetMsg && <p className="text-sm text-gray-700 text-center">{greetMsg}</p>}
        </Card>
      </div>
    </div>
  )
}
