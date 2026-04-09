import PasteInput from './PasteInput.js';

interface Props {
  label: string;
  hint?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit: (value: string) => void;
  focusKey?: string;
  placeholder?: string;
}

export default function MultilineInput({
  label,
  hint,
  value,
  onChange,
  onSubmit,
  focusKey,
  placeholder,
}: Props) {
  return (
    <PasteInput
      label={label}
      hint={hint}
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      focusKey={focusKey}
      placeholder={placeholder}
      multiline
    />
  );
}
