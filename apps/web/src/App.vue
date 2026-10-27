<script setup lang="ts">
import { onMounted, ref } from 'vue';
const apiStatus = ref('확인 중...');
onMounted(async () => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}/health`,
    );
    if (!response.ok) throw new Error('API error');
    const data: { status: string } = await response.json();
    apiStatus.value = data.status === 'ok' ? '정상 연결' : '응답 확인 필요';
  } catch {
    apiStatus.value = '연결 실패';
  }
});
</script>
<template>
  <main class="page">
    <h1>루메뜨 관리자</h1>
    <p>상품 변경 감지 시스템 · MVP v0.1</p>
    <section class="card">
      <strong>API 상태</strong>
      <p>{{ apiStatus }}</p>
    </section>
  </main>
</template>
<style scoped>
.page {
  max-width: 860px;
  margin: 5rem auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
  color: #263344;
}
.card {
  margin-top: 2rem;
  padding: 1.5rem;
  border: 1px solid #dce3eb;
  border-radius: 12px;
}
</style>
