import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { FocusScope, useFocusScope, useNavigation } from 'giggles';
import { Modal, Panel, Select } from 'giggles/ui';
import { loadProfile, saveProfile } from '../profile.js';
import type { Profile } from '../types.js';
import PasteInput from './PasteInput.js';

type Section =
  | 'none'
  | 'roles'
  | 'salary-min'
  | 'salary-max'
  | 'remote'
  | 'deal-breakers';

const REMOTE_OPTIONS: Profile['targets']['remote'][] = ['full', 'hybrid', 'any'];
const MENU_ITEMS = [
  { label: 'Edit target roles', value: 'roles' as const },
  { label: 'Edit salary range', value: 'salary-min' as const },
  { label: 'Edit remote preference', value: 'remote' as const },
  { label: 'Edit deal-breakers', value: 'deal-breakers' as const },
];

interface Props {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: Props) {
  const navigation = useNavigation();
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [section, setSection] = useState<Section>('none');
  const [rolesDraft, setRolesDraft] = useState(profile.targets.roles.join(', '));
  const [salaryDraft, setSalaryDraft] = useState('');
  const [stagedMin, setStagedMin] = useState<number | null>(null);
  const [dealBreakersDraft, setDealBreakersDraft] = useState(
    profile.targets.dealBreakers.join(', '),
  );

  function persist(next: Profile) {
    saveProfile(next);
    setProfile(next);
  }

  const root = useFocusScope({
    keybindings: {
      '1': () => navigation.reset('dashboard'),
      '2': () => navigation.push('scan'),
      '3': () => navigation.reset('profile'),
      '4': () => navigation.push('answers'),
      q: () => process.exit(0),
      escape: () => {
        if (section === 'none') {
          onBack();
          return;
        }

        setSection('none');
      },
    },
  });

  return (
    <FocusScope handle={root}>
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1} gap={2}>
          <Text bold color="cyan">
            {profile.candidate.name}
          </Text>
          <Text dimColor>{profile.headline}</Text>
        </Box>

        <Panel title="Targets" borderColor={root.hasFocus ? 'green' : 'gray'}>
          <Box flexDirection="column">
            <Text dimColor>Roles: {profile.targets.roles.join(', ') || 'none'}</Text>
            <Text dimColor>
              Salary: ${profile.targets.salaryMin.toLocaleString()} - $
              {profile.targets.salaryMax.toLocaleString()}
            </Text>
            <Text dimColor>Remote: {profile.targets.remote}</Text>
            <Text dimColor>
              Deal-breakers:{' '}
              {profile.targets.dealBreakers.length > 0
                ? profile.targets.dealBreakers.join(', ')
                : 'none'}
            </Text>
          </Box>
        </Panel>

        <Box marginTop={1}>
          <Panel title="Edit Profile" borderColor="green" width={52}>
            <Select
              options={MENU_ITEMS}
              onSubmit={(value) => {
                if (value === 'roles') {
                  setRolesDraft(profile.targets.roles.join(', '));
                }
                if (value === 'salary-min') {
                  setSalaryDraft(String(profile.targets.salaryMin));
                }
                if (value === 'deal-breakers') {
                  setDealBreakersDraft(profile.targets.dealBreakers.join(', '));
                }
                setSection(value);
              }}
              render={({ option, highlighted }) => (
                <Text color={highlighted ? 'cyan' : undefined}>
                  {highlighted ? '▶ ' : '  '}
                  {option.label}
                </Text>
              )}
            />
          </Panel>
        </Box>

        {section === 'roles' && (
          <Modal title="Target Roles" onClose={() => setSection('none')} width={64}>
            <PasteInput
              label="Comma-separated roles"
              value={rolesDraft}
              onChange={setRolesDraft}
              onSubmit={(value) => {
                const roles = value
                  .split(',')
                  .map((role) => role.trim())
                  .filter(Boolean);

                if (roles.length > 0) {
                  persist({
                    ...profile,
                    targets: { ...profile.targets, roles },
                  });
                }

                setSection('none');
              }}
            />
          </Modal>
        )}

        {section === 'salary-min' && (
          <Modal title="Salary Range" onClose={() => setSection('none')} width={40}>
            <PasteInput
              label="Minimum salary"
              value={salaryDraft}
              onChange={setSalaryDraft}
              onSubmit={(value) => {
                const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
                setStagedMin(Number.isNaN(parsed) ? profile.targets.salaryMin : parsed);
                setSalaryDraft(String(profile.targets.salaryMax));
                setSection('salary-max');
              }}
            />
          </Modal>
        )}

        {section === 'salary-max' && (
          <Modal title="Salary Range" onClose={() => setSection('none')} width={40}>
            <PasteInput
              label="Maximum salary"
              value={salaryDraft}
              onChange={setSalaryDraft}
              onSubmit={(value) => {
                const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10);
                persist({
                  ...profile,
                  targets: {
                    ...profile.targets,
                    salaryMin: stagedMin ?? profile.targets.salaryMin,
                    salaryMax: Number.isNaN(parsed)
                      ? profile.targets.salaryMax
                      : parsed,
                  },
                });
                setStagedMin(null);
                setSection('none');
              }}
            />
          </Modal>
        )}

        {section === 'remote' && (
          <Modal title="Remote Preference" onClose={() => setSection('none')} width={36}>
            <Select
              options={REMOTE_OPTIONS.map((option) => ({
                label: option,
                value: option,
              }))}
              value={profile.targets.remote}
              onSubmit={(value) => {
                persist({
                  ...profile,
                  targets: { ...profile.targets, remote: value },
                });
                setSection('none');
              }}
              render={({ option, highlighted }) => (
                <Text color={highlighted ? 'cyan' : undefined}>
                  {highlighted ? '▶ ' : '  '}
                  {option.label}
                </Text>
              )}
            />
          </Modal>
        )}

        {section === 'deal-breakers' && (
          <Modal title="Deal-breakers" onClose={() => setSection('none')} width={64}>
            <PasteInput
              label="Comma-separated deal-breakers"
              value={dealBreakersDraft}
              onChange={setDealBreakersDraft}
              onSubmit={(value) => {
                persist({
                  ...profile,
                  targets: {
                    ...profile.targets,
                    dealBreakers: value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  },
                });
                setSection('none');
              }}
            />
          </Modal>
        )}
      </Box>
    </FocusScope>
  );
}
