<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Product, ProductDetail, ChangeLog, Dashboard } from '@lumette/shared/product';

defineOptions({ name: 'LumetteAdmin' });

const tab = ref('dashboard');
const loading = ref(false);
const error = ref('');
const products = ref<Product[]>([]);
const changes = ref<ChangeLog[]>([]);
const dashboard = ref<Dashboard>({ productCount: 0, recentChangeCount: 0, days: 7 });
const page = ref(1);
const total = ref(0);
const changeTotal = ref(0);
const detail = ref<ProductDetail>();
const detailOpen = ref(false);
const detailLoading = ref(false);
const detailError = ref('');
let detailRequest = 0;
const labels = { PRICE: '가격', STATUS: '판매 상태', NAME: '상품명' };
const statuses = { ACTIVE: '판매 중', SOLD_OUT: '품절', DISCONTINUED: '판매 종료' };

async function api<T>(path: string): Promise<T> {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}${path}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error('API 요청 실패');
  return response.json() as Promise<T>;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [summary, list, history] = await Promise.all([
      api<Dashboard>('/api/dashboard'),
      api<{ items: Product[]; total: number }>(`/api/products?page=${page.value}`),
      api<{ items: ChangeLog[]; total: number }>('/api/products/changes'),
    ]);
    dashboard.value = summary;
    products.value = list.items;
    total.value = list.total;
    changes.value = history.items;
    changeTotal.value = history.total;
  } catch {
    error.value =
      'API 데이터를 불러오지 못했습니다. 서버 연결과 DB 마이그레이션 상태를 확인하세요.';
  } finally {
    loading.value = false;
  }
}

async function showDetail(row: Product) {
  const request = ++detailRequest;
  detail.value = undefined;
  detailOpen.value = true;
  detailLoading.value = true;
  detailError.value = '';
  try {
    const result = await api<ProductDetail>(`/api/products/${encodeURIComponent(row.id)}`);
    if (request === detailRequest) detail.value = result;
  } catch {
    if (request === detailRequest) detailError.value = '상품 상세를 불러오지 못했습니다.';
  } finally {
    if (request === detailRequest) detailLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="page">
    <header>
      <div>
        <h1>루메뜨 관리자</h1>
        <p>상품 관리 · 공급처 변경 감지</p>
      </div>
      <el-button :loading="loading" @click="load">새로고침</el-button>
    </header>
    <el-alert
      title="샘플 상품에는 샘플 표시가 붙습니다. 공급처 변경은 판매 상품에 자동 반영되지 않습니다."
      type="info"
      :closable="false"
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="notice" />
    <el-tabs v-model="tab">
      <el-tab-pane label="대시보드" name="dashboard">
        <div v-loading="loading" class="stats">
          <el-card
            ><span>전체 판매 상품</span>
            <h2>{{ dashboard.productCount }}개</h2></el-card
          ><el-card
            ><span>최근 {{ dashboard.days }}일 변경</span>
            <h2>{{ dashboard.recentChangeCount }}건</h2></el-card
          >
        </div>
      </el-tab-pane>
      <el-tab-pane label="상품 관리" name="products">
        <el-table
          v-loading="loading"
          :data="products"
          empty-text="등록된 상품이 없습니다."
          @row-click="showDetail"
        >
          <el-table-column prop="sku" label="상품 코드" min-width="200" />
          <el-table-column prop="name" label="상품명" min-width="180" />
          <el-table-column label="판매 가격"
            ><template #default="{ row }">{{ row.price }} 원</template></el-table-column
          >
          <el-table-column label="상태"
            ><template #default="{ row }: { row: Product }">{{
              statuses[row.status]
            }}</template></el-table-column
          >
          <el-table-column label="구분"
            ><template #default="{ row }"
              ><el-tag v-if="row.isSample" type="info">샘플</el-tag
              ><span v-else>운영</span></template
            ></el-table-column
          >
          <el-table-column label="상세"
            ><template #default="{ row }"
              ><el-button link type="primary" @click.stop="showDetail(row)"
                >상세 보기</el-button
              ></template
            ></el-table-column
          >
        </el-table>
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="20"
          layout="prev, pager, next, total"
          @current-change="load"
        />
      </el-tab-pane>
      <el-tab-pane label="변경 이력" name="changes">
        <p>전체 {{ changeTotal }}건 중 최신 100건</p>
        <el-table v-loading="loading" :data="changes" empty-text="감지된 변경이 없습니다.">
          <el-table-column prop="supplierProduct.name" label="공급처 상품" min-width="180" />
          <el-table-column label="변경 항목"
            ><template #default="{ row }: { row: ChangeLog }">{{
              labels[row.field]
            }}</template></el-table-column
          >
          <el-table-column prop="previousValue" label="이전 값" min-width="130" />
          <el-table-column prop="newValue" label="변경된 값" min-width="130" />
          <el-table-column label="감지 시각" min-width="180"
            ><template #default="{ row }">{{
              new Date(row.createdAt).toLocaleString('ko-KR')
            }}</template></el-table-column
          >
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <el-drawer v-model="detailOpen" title="상품 상세" size="min(90vw, 600px)">
      <div v-loading="detailLoading">
        <el-alert v-if="detailError" :title="detailError" type="error" />
        <template v-if="detail"
          ><h2>{{ detail.name }}</h2>
          <p>{{ detail.sku }}</p>
          <p>판매 가격: {{ detail.price }} 원 · {{ statuses[detail.status] }}</p>
          <h3>연결된 공급처 상품</h3>
          <el-empty
            v-if="!detail.mappings.length"
            description="매핑된 공급처 상품이 없습니다."
          /><el-card v-for="mapping in detail.mappings" :key="mapping.id" class="notice"
            ><strong>{{ mapping.supplierProduct.name }}</strong>
            <p>{{ mapping.supplierProduct.supplier }} · {{ mapping.supplierProduct.externalId }}</p>
            <p>
              {{ mapping.supplierProduct.price }} 원 ·
              {{ statuses[mapping.supplierProduct.status] }}
            </p></el-card
          ></template
        >
      </div>
    </el-drawer>
  </main>
</template>

<style scoped>
.page {
  max-width: 1280px;
  margin: 2rem auto;
  padding: 1.5rem;
  color: #263344;
  font-family: system-ui, sans-serif;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.notice {
  margin-top: 1rem;
}
.el-tabs {
  margin-top: 1.5rem;
}
.el-pagination {
  margin-top: 1rem;
}
</style>
