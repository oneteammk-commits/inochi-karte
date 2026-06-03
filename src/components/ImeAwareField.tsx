import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

function isComposingInput(
  composingRef: React.MutableRefObject<boolean>,
  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
): boolean {
  const native = e.nativeEvent as InputEvent
  return composingRef.current || native.isComposing === true
}

/** 親の value とローカル表示を同期し、IME 変換中は親 state を更新しない */
function useImeAwareTextState(value: string, onValueChange: (value: string) => void) {
  const composingRef = useRef(false)
  const [local, setLocal] = useState(value)
  const lastCommittedRef = useRef(value)

  useEffect(() => {
    if (composingRef.current) return
    if (lastCommittedRef.current !== value) {
      lastCommittedRef.current = value
      setLocal(value)
    }
  }, [value])

  const onCompositionStart = () => {
    composingRef.current = true
  }

  const onCompositionUpdate = () => {
    composingRef.current = true
  }

  const onCompositionEnd = (
    e: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    composingRef.current = false
    const next = e.currentTarget.value
    setLocal(next)
    lastCommittedRef.current = next
    onValueChange(next)
  }

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value
    setLocal(next)
    if (!isComposingInput(composingRef, e)) {
      lastCommittedRef.current = next
      onValueChange(next)
    }
  }

  return {
    value: local,
    onCompositionStart,
    onCompositionUpdate,
    onCompositionEnd,
    onChange,
  }
}

type ImeAwareInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

export function ImeAwareInput({ value, onValueChange, type = 'text', ...props }: ImeAwareInputProps) {
  const ime = useImeAwareTextState(value, onValueChange)
  return <input type={type} {...props} {...ime} />
}

type ImeAwareTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
> & {
  value: string
  onValueChange: (value: string) => void
}

export function ImeAwareTextarea({ value, onValueChange, ...props }: ImeAwareTextareaProps) {
  const ime = useImeAwareTextState(value, onValueChange)
  return <textarea {...props} {...ime} />
}
