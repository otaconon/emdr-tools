<template>
  <div class="client-container">
    <MovingCircle
      :size="params.size"
      :speed="params.speed"
      :color="params.color"
      :resetToken="resetToken"
      :shouldStop="!isPlaying"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import MovingCircle from '../components/MovingCircle.vue';
import { WebSocketMessage, type Params } from '../proto/messages';
import { socket } from '../socket';

const params = ref<Params>({
  size: 40,
  speed: 200,
  color: "#00ff00",
  sid: ""
});

const resetToken = ref(0);
const isPlaying = ref(false);

const route = useRoute();
const sid = (route.query.sid as string) ?? undefined;

const toUint8Array = async (data: unknown): Promise<Uint8Array> => {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (typeof data === "string") return new TextEncoder().encode(data);
  throw new Error("Nieznany typ danych z WebSocket");
};

const onMessage = async (event: MessageEvent) => {
  try {
    const buffer = await toUint8Array(event.data);
    const decoded = WebSocketMessage.decode(buffer);
    console.log("Received message");

    if (decoded.joinSessionResponse?.accepted) {
      resetToken.value += 1;
    }

    if (decoded.params) {
      params.value = {
        size: decoded.params.size,
        speed: decoded.params.speed,
        color: decoded.params.color,
        sid: decoded.params.sid
      };
    } else if (decoded.play) {
      isPlaying.value = true;
    } else if (decoded.stop) {
      isPlaying.value = false;
    }
  } catch (err) {
    console.error("[Client] Protobuf decode error:", err);
  }
};

const sendJoin = () => {
  try {
    const msg = WebSocketMessage.create({
      joinSessionRequest: { sid }
    });
    const buf = WebSocketMessage.encode(msg).finish();
    socket.send(buf);
  } catch (e) {
    console.error("[Client] Send JoinSessionRequest error:", e);
  }
};

const onOpen = () => sendJoin();

onMounted(() => {
  if (socket) {
    socket.binaryType = "arraybuffer";
  }

  socket.addEventListener("message", onMessage);

  if (!sid) {
    console.warn("[Client] Brak `sid` w URL. Oczekuję adresu typu /client?sid=...");
    return;
  }

  if (socket.readyState === WebSocket.OPEN) {
    sendJoin();
  } else if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener("open", onOpen, { once: true });
  } else {
    console.error("Socket is disconnected. Refresh the page to reconnect.");
  }
});

onUnmounted(() => {
  socket.removeEventListener("message", onMessage);
  socket.removeEventListener("open", onOpen);
});
</script>

<style scoped>
.client-container {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}
</style>