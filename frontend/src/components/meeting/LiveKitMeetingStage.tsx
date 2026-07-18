import { useEffect } from 'react'
import {
  ConnectionQualityIndicator,
  GridLayout,
  ParticipantName,
  ParticipantPlaceholder,
  ParticipantTile,
  TrackMutedIndicator,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTrackRefContext,
  useTracks,
} from '@livekit/components-react'
import { MonitorUp } from 'lucide-react'
import { Track } from 'livekit-client'

import { useTranslation } from '@/hooks/useTranslation'

type MediaKind = 'microphone' | 'camera' | 'screen'

export interface LiveKitMeetingStageProps {
  microphoneEnabled: boolean
  cameraEnabled: boolean
  sharingEnabled: boolean
  onMicrophoneTrackChange: (track: MediaStreamTrack | null) => void
  onMediaStateRejected: (kind: MediaKind) => void
}

export function LiveKitMeetingStage({
  microphoneEnabled,
  cameraEnabled,
  sharingEnabled,
  onMicrophoneTrackChange,
  onMediaStateRejected,
}: LiveKitMeetingStageProps) {
  const { t } = useTranslation()
  const {
    localParticipant,
    microphoneTrack,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  useEffect(() => {
    if (isMicrophoneEnabled === microphoneEnabled) {
      return
    }

    let active = true
    void localParticipant
      .setMicrophoneEnabled(microphoneEnabled)
      .catch(() => {
        if (active) {
          onMediaStateRejected('microphone')
        }
      })

    return () => {
      active = false
    }
  }, [
    isMicrophoneEnabled,
    localParticipant,
    microphoneEnabled,
    onMediaStateRejected,

  ])

  useEffect(() => {
    if (isCameraEnabled === cameraEnabled) {
      return
    }

    let active = true
    void localParticipant.setCameraEnabled(cameraEnabled).catch(() => {
      if (active) {
        onMediaStateRejected('camera')
      }
    })

    return () => {
      active = false
    }
  }, [
    cameraEnabled,
    isCameraEnabled,
    localParticipant,
    onMediaStateRejected,
  ])

  useEffect(() => {
    if (isScreenShareEnabled === sharingEnabled) {
      return
    }

    let active = true
    void localParticipant
      .setScreenShareEnabled(sharingEnabled)
      .catch(() => {
        if (active) {
          onMediaStateRejected('screen')
        }
      })

    return () => {
      active = false
    }
  }, [
    isScreenShareEnabled,
    localParticipant,
    onMediaStateRejected,
    sharingEnabled,
  ])

  useEffect(() => {
    const mediaTrack =
      microphoneTrack?.audioTrack?.mediaStreamTrack ?? null
    onMicrophoneTrackChange(mediaTrack)

    return () => onMicrophoneTrackChange(null)
  }, [microphoneTrack, onMicrophoneTrackChange])

  return (
    <GridLayout
      tracks={tracks}
      aria-label={t('stage.ariaLabel')}
      className="h-full min-h-0 w-full"
    >
      <LocalizedParticipantTile />
    </GridLayout>
  )
}

function LocalizedParticipantTile() {
  const { t } = useTranslation()
  const trackRef = useTrackRefContext()
  const isScreenShare = trackRef.source === Track.Source.ScreenShare
  const participantLabel =
    trackRef.participant.name || trackRef.participant.identity
  const hasUsableVideo =
    isTrackReference(trackRef) &&
    trackRef.publication?.kind === Track.Kind.Video &&
    !trackRef.publication.isMuted &&
    Boolean(trackRef.publication.track)

  return (
    <ParticipantTile
      aria-label={t(
        isScreenShare
          ? 'stage.participantScreen'
          : 'stage.participantVideo',
        { name: participantLabel },
      )}
      className="overflow-hidden rounded-[10px]"
    >
      {hasUsableVideo ? (
        <VideoTrack trackRef={trackRef} />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-video-tile">
          <ParticipantPlaceholder
            className="h-full w-auto p-[10%]"
            aria-hidden="true"
          />
        </div>
      )}

      <div className="lk-participant-metadata">
        <div className="lk-participant-metadata-item min-w-0">
          {isScreenShare ? (
            <MonitorUp
              className="mr-1 size-3.5 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <TrackMutedIndicator
              trackRef={{
                participant: trackRef.participant,
                source: Track.Source.Microphone,
              }}
              show="muted"
            />
          )}
          <ParticipantName className="truncate" />
          {isScreenShare && (
            <span className="truncate">
              {' '}
              · {t('stage.screenShare')}
            </span>
          )}
        </div>
        <ConnectionQualityIndicator
          className="lk-participant-metadata-item"
          aria-hidden="true"
        />
      </div>
    </ParticipantTile>
  )
}
