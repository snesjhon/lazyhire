/** @jsxImportSource @opentui/react */
import 'opentui-spinner/react';
import type { SpinnerOptions } from 'opentui-spinner';

interface Props {
  color?: string;
  name?: SpinnerOptions['name'];
}

export default function Spinner({ color = 'white', name = 'dots' }: Props) {
  return <spinner color={color} name={name} />;
}
