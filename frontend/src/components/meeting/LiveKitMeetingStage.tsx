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
  useRoomContext,
  useTrackRefContext,
  useTracks,
} from '@livekit/components-react'
import { MonitorUp } from 'lucide-react'
import { Track } from 'livekit-client'

import { useTranslation } from '@/hooks/useTranslation'

type MediaKind = 'microphone' | 'camera' | 'screen' | 'speaker'

export interface MeetingStageState {
  hasRemoteParticipant: boolean
  hasRemoteVideo: boolean
}

export interface LiveKitMeetingStageProps {
  microphoneEnabled: boolean
  cameraEnabled: boolean
  sharingEnabled: boolean
  microphoneId: string
  speakerId: string
  onMicrophoneTrackChange: (track: MediaStreamTrack | null) => void
  onMediaStateRejected: (kind: MediaKind) => void
  onStageStateChange: (state: MeetingStageState) => void
}

export function LiveKitMeetingStage({
  microphoneEnabled,
  cameraEnabled,
  sharingEnabled,
  microphoneId,
  speakerId,
  onMicrophoneTrackChange,
  onMediaStateRejected,
  onStageStateChange,
}: LiveKitMeetingStageProps) {
  const { t } = useTranslation()
  const room = useRoomContext()
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
  const hasRemoteParticipant = tracks.some(
    (track) => !track.participant.isLocal,
  )
  const hasRemoteVideo = tracks.some(
    (track) =>
      !track.participant.isLocal &&
      isTrackReference(track) &&
      track.publication?.kind === Track.Kind.Video &&
      !track.publication.isMuted &&
      Boolean(track.publication.track),
  )

  useEffect(() => {
    onStageStateChange({ hasRemoteParticipant, hasRemoteVideo })
  }, [hasRemoteParticipant, hasRemoteVideo, onStageStateChange])

  useEffect(() => {
    if (!microphoneId) {
      return
    }

    void room
      .switchActiveDevice('audioinput', microphoneId)
      .catch(() => onMediaStateRejected('microphone'))
  }, [microphoneId, onMediaStateRejected, room])

  useEffect(() => {
    if (!speakerId) {
      return
    }

    void room
      .switchActiveDevice('audiooutput', speakerId)
      .catch(() => onMediaStateRejected('speaker'))
  }, [onMediaStateRejected, room, speakerId])

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
