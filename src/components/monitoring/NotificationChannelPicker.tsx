import React from 'react'
import {
  type NotificationChannel,
  NOTIFICATION_CHANNEL_TYPE_LABELS
} from '../../services/alertingService'

interface NotificationChannelPickerProps {
  legend?: string
  channels: NotificationChannel[]
  selectedChannelIds: string[]
  onChange: (nextSelection: string[]) => void
  disabled?: boolean
  idPrefix?: string
}

export function NotificationChannelPicker({
  legend = 'Canaux de notification',
  channels,
  selectedChannelIds,
  onChange,
  disabled,
  idPrefix = 'alert-channel'
}: NotificationChannelPickerProps) {
  const handleToggle = (channelId: string) => {
    if (disabled) {
      return
    }

    const isSelected = selectedChannelIds.includes(channelId)
    if (isSelected) {
      onChange(selectedChannelIds.filter(id => id !== channelId))
      return
    }

    onChange([...selectedChannelIds, channelId])
  }

  return (
    <fieldset
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <legend style={{ fontWeight: 600, fontSize: '0.95rem' }}>{legend}</legend>
      {channels.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
          Aucun canal n'est disponible pour le moment.
        </p>
      ) : (
        channels.map(channel => {
          const isSelected = selectedChannelIds.includes(channel.id)
          const label = `${NOTIFICATION_CHANNEL_TYPE_LABELS[channel.type]} — ${channel.name}`
          const inputId = `${idPrefix}-${channel.id}`
          return (
            <label
              key={channel.id}
              htmlFor={inputId}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: '10px',
                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : '#fff',
                border: `1px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`
              }}
              data-testid={`${idPrefix}-${channel.id}`}
            >
              <input
                id={inputId}
                type="checkbox"
                checked={isSelected}
                disabled={disabled}
                onChange={() => handleToggle(channel.id)}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{label}</div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>{channel.target}</div>
              </div>
            </label>
          )
        })
      )}
    </fieldset>
  )
}

