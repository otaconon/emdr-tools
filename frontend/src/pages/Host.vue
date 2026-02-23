<template>
  <div class="host-root">
    <section class="preview-surface">
      <MovingCircle :size="size" :speed="speed" :color="color" :boundToParent="true" :resetToken="resetToken"
        :shouldStop="!isPlaying" @bounce="bounceCount++" />
    </section>

    <section class="controls-surface">
      <div class="first-row">
        <button type="button" class="btn" @click="onPlayStopPressed">
          {{ isPlaying ? "Stop" : "Play" }}
        </button>

        <div class="bounce-counter">
          Liczba machnięć: <strong>{{ Math.floor(bounceCount / 2) }}</strong>
        </div>

        <div class="control speed-control">
          <label for="speed">Speed</label>
          <input id="speed" type="range" min="50" max="3000" step="10" v-model.number="speed" />
          <div class="value-badge">{{ speed }}</div>
        </div>
      </div>

      <div class="second-row">
        <div class="control">
          <label for="size">Size</label>
          <input id="size" type="range" min="10" max="300" v-model.number="size" />
          <div class="value-badge">{{ size }}px</div>
        </div>

        <div class="control color-control">
          <label for="color">Color</label>
          <input id="color" type="color" v-model="color" />
          <div class="value-badge value-badge--mono">{{ color }}</div>
        </div>
      </div>
      <form class="controls-vertical" @submit.prevent="updateParams">
        <div class="third-row">
          <button type="submit" class="btn" :class="{ clicked: isUpdated }" :disabled="!sid || isUpdated">
            {{ isUpdated ? "✔ Updated!" : "Update" }}
          </button>
          <button type="button" class="btn" @click="createSession">
            Utwórz linka
          </button>
          <div :class="['client-status-badge', clientConnected ? 'connected' : 'waiting']" aria-live="polite">
            <span class="dot"></span>
            {{ clientConnected ? "Klient podłączony" : "Oczekiwanie na klienta…" }}
          </div>
        </div>
      </form>
      <div class="session-box">
        <div v-if="sessionUrl" class="session-url">
          Link do sesji:&nbsp;
          <a :href="sessionUrl" target="_blank" rel="noreferrer">{{ sessionUrl }}</a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { WebSocketMessage, Params } from '../proto/messages';
import { socket } from '../socket';
import MovingCircle from '../components/MovingCircle.vue';
import './Host.css';

const THROTTLE_MS = 200;

const savedSize = localStorage.getItem("host-size");
const savedSpeed = localStorage.getItem("host-speed");
const savedColor = localStorage.getItem("host-color");

const size = ref(savedSize ? parseInt(savedSize, 10) : 40);
const speed = ref(savedSpeed ? parseInt(savedSpeed, 10) : 200);
const color = ref(savedColor ? savedColor : "#00ff00");

const isUpdated = ref(false);
const isPlaying = ref(false);

const sessionUrl = ref<string | null>(null);
const sid = ref<string | undefined>(undefined);

const resetToken = ref(0);
const bounceCount = ref(0);
const clientConnected = ref(false);

const toUint8Array = async (data: unknown): Promise<Uint8Array> => {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (typeof data === "string") return new TextEncoder().encode(data);
  // @ts-ignore
  if (data?.byteLength && data?.buffer) return new Uint8Array(data);
  throw new Error("[Host] Nieznany typ danych z WebSocket");
};

const onMessage = async (ev: MessageEvent) => {
  try {
    const buffer = await toUint8Array(ev.data);
    const msg = WebSocketMessage.decode(buffer);

    if (msg.createSessionResponse) {
      const { accepted, sessionUrl: url } = msg.createSessionResponse;
      if (accepted && url) {
        sessionUrl.value = url;
        clientConnected.value = false;

        try {
          await navigator.clipboard.writeText(url);
          console.log("Copied link to clipboard");
        } catch (err) {
          console.error("Couldn't copy link to clipboard: ", err);
        }

        try {
          const u = new URL(url);
          const s = u.searchParams.get("sid");
          if (s) sid.value = s;
        } catch {
          const parts = String(url).split("sid=");
          if (parts[1]) sid.value = parts[1].split("&")[0];
        }
      }
    } else if (msg.joinSessionResponse) {
      if (msg.joinSessionResponse.accepted) {
        clientConnected.value = true;
        resetToken.value++;
        bounceCount.value = 0;
      }
    }
  } catch (e) {
    console.error("[Host] Decode error:", e);
  }
};

const sendParams = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket nie jest połączony");
    return false;
  }
  if (!sid.value) {
    console.warn("Brak SID — najpierw utwórz linka.");
    return false;
  }
  const paramsMsg = Params.create({
    size: size.value,
    speed: speed.value,
    color: color.value,
    sid: sid.value
  });
  const wsMsg = WebSocketMessage.create({ params: paramsMsg });
  const buffer = WebSocketMessage.encode(wsMsg).finish();
  socket.send(buffer);
  return true;
};

const updateParams = () => {
  const ok = sendParams();
  if (!ok) return;
  isUpdated.value = true;
  setTimeout(() => isUpdated.value = false, 1000);
};

const createSession = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket nie jest połączony");
    return;
  }
  const wsMsg = WebSocketMessage.create({ createSessionRequest: {} });
  const buffer = WebSocketMessage.encode(wsMsg).finish();
  socket.send(buffer);
};

const onPlayStopPressed = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket nie jest połączony");
  } else {
    let wsMsg: WebSocketMessage;
    if (!isPlaying.value) {
      wsMsg = WebSocketMessage.create({ play: {} });
    } else {
      wsMsg = WebSocketMessage.create({ stop: {} });
    }
    const buffer = WebSocketMessage.encode(wsMsg).finish();
    socket.send(buffer);
  }
  isPlaying.value = !isPlaying.value;
  bounceCount.value = 0;
};

onMounted(() => {
  if (socket) socket.binaryType = "arraybuffer";
  socket.addEventListener("message", onMessage);
});

onUnmounted(() => {
  socket.removeEventListener("message", onMessage);
});

let lastSentAt = 0;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

watch([size, speed, sid], () => {
  if (!sid.value || !socket || socket.readyState !== WebSocket.OPEN) return;

  const now = Date.now();
  const elapsed = now - lastSentAt;

  if (elapsed >= THROTTLE_MS) {
    if (sendParams()) lastSentAt = Date.now();
    return;
  }

  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    if (sendParams()) lastSentAt = Date.now();
    pendingTimer = null;
  }, THROTTLE_MS - elapsed);
});

watch([size, speed, color], ([newSize, newSpeed, newColor]) => {
  localStorage.setItem("host-size", newSize.toString());
  localStorage.setItem("host-speed", newSpeed.toString());
  localStorage.setItem("host-color", newColor);
});
</script>