# 개발 규칙

## 코드 스타일

### 작명 규칙

| 항목 | 규칙 | 예시 |
|------|------|------|
| 파일명 (클래스 모듈) | **PascalCase** | `NeuralNetwork.js`, `Visualizer.js` |
| 파일명 (일반 모듈) | **camelCase** | `ui.js`, `app.js` |
| 변수 / 함수 | **camelCase** | `selectedNeuron`, `recomputeDetail()` |
| CSS 클래스 | **BEM** (`__` 요소, `--` 수식어) | `.panel__title--active` |

### 문법

| 항목 | 규칙 |
|------|------|
| 들여쓰기 | **4칸 스페이스** |
| 세미콜론 | **항상 사용** |
| 문자열 | 작은따옴표 `' '` 기본, 템플릿 리터럴에는 `` ` `` (백틱) |
| 변수 선언 | **`const`** 우선, 재할당 필요시만 `let` |
| 비교 | **`===` / `!==`** (느슨한 비교 금지) |
| 함수 | **화살표 함수** 우선 |
| 객체/배열 복사 | **스프레드 연산자** `...` |
| 주석 / UI 문자열 | **한글** | 주석과 UI 문자열 모두 한글 사용 |
| 함수/메서드 구분 | **구분 불필요** | Alpine 핸들러도 내부 헬퍼도 동일한 camelCase. 재사용 필요시 래핑 함수 사용 |

### 비구조화 할당

- 함수 **인자**에서 출처가 명확할 때 사용 (권장)
- 함수 **내부**에서 여러 객체를 다룰 땐 **점표기법** 사용 (값의 출처를 명확히 구분)

```js
// 👍 좋음 (인자에서 출처가 명확)
function printUser({ name, email }) { ... }

// 👎 나쁨 (내부에서 여러 객체를 다룰 때)
const { name } = user;
const { email } = contact;
doSomething(name, email);
// 어디서 온 값인지 한눈에 파악 어려움

// 👍 좋음 (내부에서는 점표기법)
doSomething(user.name, contact.email);
```

### 함수 작성 원칙

#### 1. 한 함수는 한 역할만
하나의 함수는 하나의 책임만 가집니다. 여러 일을 하는 함수는 분리합니다.

```js
// 👎 나쁨
function step() {
    forward();
    backward();
    update();
    forward();
    updateUI();
    draw();
    if (selectedNeuron) recomputeDetail();
}

// 👍 좋음 — step()은 '호출 흐름'만 드러냄
function step() {
    forward();
    backward();
    update();
    forward();
    refreshAll();
}
```

#### 2. 함수 사용 흐름만 봐도 로직이 명확해야 함
함수 이름과 호출 순서만 읽어도 무엇을 하는지 파악 가능해야 합니다. 내부 구현 길이보다 **호출부의 가독성**이 우선입니다.

```js
function refreshAll() {
    updateStatusBar();
    redrawCanvas();
    refreshDetailIfNeeded();
}
```

#### 3. 확장성 우선
개발 속도보다 **유지보수·관리·추가 개발 용이성**을 우선합니다. 중복보다 추상화, 하드코딩보다 설정화를 지향합니다.

#### 4. Early Return
조건문 중첩(`if ... else if ... else`) 대신, 관심 없는 경우를 앞에서 `return`으로 걸러냅니다. 사람이 읽을 때 "내 경우가 아니면 넘어감" 순서로 가독성이 좋아집니다.

```js
// 👎 나쁨
if (condition) {
    // 본 로직 (들여쓰기 깊음)
} else {
    // 처리
}

// 👍 좋음
if (!condition) {
    return handleOtherCase();
}
// 본 로직 (깊은 들여쓰기 없음)
```

#### 5. Error Handling — 필요한 곳에서만 catch
`try/catch`를 함수마다 중첩해서 쓰지 않습니다. `catch`나 `finally`에서 처리할 내용이 있을 때만 사용하고, 그 외에는 알아서 `unhandled error`로 전파되게 둡니다. 브라우저 기본 에러 처리에 맡깁니다.

```js
// 👎 나쁨 — 잡기만 하고 아무 처리 없음
try {
    nn.forward(input);
} catch (e) {
    // 아무것도 안 함
    throw e;
}

// 👍 좋음 — 에러를 잡아서 UI에 보여줄 내용이 있을 때만 catch
try {
    nn.forward(input);
} catch (e) {
    showToast('순전파 실패: ' + e.message);
}

// 👍 좋음 — 처리할 게 없으면 catch 생략
function doForward() {
    nn.forward(input);
    refreshAll();
}
```

### 상태 변경 규칙
Alpine store(`ui.js`)의 상태는 **메서드로만 변경**합니다. 직접 할당(`this.nn = x`)은 하지 않습니다.

```js
// 👎 나쁨 — 직접 할당
this.selectedNeuron = { layer: 1, idx: 0 };

// 👍 좋음 — 메서드 경유
selectNeuron(1, 0); // 내부에서 this.selectedNeuron = ... 처리

// 👎 나쁨 — 상태를 외부에서 직접 변경
nn.forward(input);

// 👍 좋음 — store 메서드를 통해 간접 실행
this.doForward();
```

### 커밋 메시지

```
접두사: 한글 설명
```

| 접두사 | 의미 |
|--------|------|
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 코드 구조 개선 (동작 변경 없음) |
| `docs` | 문서 변경 |
| `style` | 코드 포맷 변경 |
| `chore` | 빌드/설정 변경 |

```text
feat: 역전파 오차 전달 시각화 추가
fix: 출력값이 캔버스 범위를 벗어나던 버그 수정
refactor: 단일 HTML 파일을 모듈 구조로 분리
```

### Import 규칙

```js
// 1. 외부 라이브러리 (CDN 등은 import 없음)
// 2. 내부 모듈 (src/ 아래)
import NeuralNetwork from './NeuralNetwork.js';
import Visualizer from './Visualizer.js';
```

### Export 규칙

```js
// 파일 마지막에 export default (권장)
export default NeuralNetwork;
```

## UI 아키텍처

UI는 **Alpine.js 3.x**를 통해 컴포넌트 기반으로 관리됩니다. `src/ui.js`의 `appStore()` 함수가 Alpine 컴포넌트의 상태를 정의하고, `index.html`은 Alpine 디렉티브로 상태를 바인딩합니다.

### HTML 속성 순서

```
id → class → x-data / x-show → x-bind / :attr → @event
```

```html
<div id="foo" class="panel panel--active"
     x-data="{ open: true }" x-show="open"
     :class="{ 'panel--hidden': !open }"
     @click="toggle">
```

### 핵심 원칙

#### 1. 문자열 결합 금지
`innerHTML`로 HTML을 조립하지 않습니다. 모든 HTML 구조는 `index.html`에 Alpine 디렉티브로 선언하고, 데이터는 JS에서만 처리합니다.

**나쁜 예:**
```js
document.getElementById('dpFormula').innerHTML = `<span>값: ${x}</span>`;
```

**좋은 예:**
```html
<div class="formula" x-html="dpData.formulaHtml"></div>
```
```js
// ui.js — 데이터만 조립, DOM은 Alpine이 처리
dpData: {
  formulaHtml: `<span>값: ${x}</span>`,
  ...
}
```

#### 2. 직접 DOM 조작 금지
`document.createElement`, `appendChild`, `classList.add` 등 DOM API를 직접 호출하지 않습니다.

**나쁜 예:**
```js
document.getElementById('infoBar').classList.add('active');
```

**좋은 예:**
```html
<div x-bind:class="{ 'active': isActive }"></div>
```

#### 3. Alpine.js 템플릿 우선
`index.html`에 Alpine 디렉티브만 사용하여 UI를 선언적으로 표현합니다:

| 디렉티브 | 용도 |
|----------|------|
| `x-text` | 텍스트 출력 |
| `x-html` | HTML 출력 (계산식처럼 색상 태그 필요시) |
| `x-show` / `x-if` | 조건부 표시 |
| `x-for` | 반복 목록 |
| `x-bind` / `:attr` | 속성 바인딩 |
| `x-model` | 양방향 바인딩 |
| `@click` 등 | 이벤트 리스너 |

#### 4. 반응형 상태
`src/ui.js`의 `appStore()`가 모든 상태를 정의합니다. `selectedNeuron`, `nn`, `dpData` 등의 값이 변경되면 Alpine이 자동으로 DOM을 갱신합니다.

`nn`(NeuralNetwork) 객체의 내부 변화는 Alpine의 깊은 반응형 감지 범위 밖이므로, `doStep()` 등 실행 후 `recomputeDetail()`을 명시적으로 호출하여 상세 패널을 갱신합니다.

#### 5. CSS 분리
모든 스타일은 `src/styles.css`에 있으며, `index.html`은 `<link rel="stylesheet" href="src/styles.css">`로 참조합니다.

#### 6. Canvas ↔ Alpine 통신
Visualizer(Canvas)는 Alpine 밖에서 동작하므로, 필요한 상태는 **인자로 전달**합니다.

```js
// 👍 좋음 — 인자로 필요한 상태만 전달
viz.draw(nn, { selectedNeuron: this.selectedNeuron });

// 👎 나쁨 — viz가 외부 상태를 직접 참조
viz.selectedNeuron = this.selectedNeuron;
viz.draw();
```

## 클래스 아키텍처

### 역할 범위
각 클래스는 **비즈니스 로직**만 담당합니다. Alpine이나 DOM을 직접 참조하지 않습니다.

| 클래스 | 역할 | UI 의존 |
|--------|------|---------|
| `NeuralNetwork` | 순전파/역전파/업데이트 계산 | 없음 |
| `Visualizer` | Canvas 2D 렌더링 | 없음 (인자로 데이터 수신) |
| `SeededRandom` | 난수 생성 | 없음 |

```js
// 👎 나쁨 — 클래스 내부에서 DOM 접근
class NeuralNetwork {
    forward(input) {
        const lr = document.getElementById('learningRate').value; // 💩
    }
}

// 👍 좋음 — 순수 계산만, 값은 외부에서 전달
class NeuralNetwork {
    forward(input) { /* 계산만 */ }
    update(lr) { /* lr은 인자로 */ }
}
```

### 인스턴스 생명주기
모든 인스턴스는 **`app.js`에서 생성**하고, 필요한 곳에 주입합니다.

```js
// app.js — 생성과 주입의 단일 책임
import Visualizer from './Visualizer.js';

const viz = new Visualizer(canvas);

Alpine.data('app', () => appStore({ viz }));
```

### 클래스 내부 상태
각 클래스는 자신의 상태를 `this`에 보유합니다.

| 클래스 | 내부 상태 |
|--------|-----------|
| `NeuralNetwork` | `weights`, `biases`, `as`, `deltas`, `zs`, `loss` 등 |
| `Visualizer` | `canvas`, `ctx`, `w`, `h`, `lastPositions` |
| `SeededRandom` | `seed` |

### Visualizer 그리기 방식
`draw()` 호출 시 **전체 캔버스를 클리어하고 전부 다시 그립니다**. 부분 업데이트는 하지 않습니다.

```js
draw(nn, options = {}) {
    ctx.clearRect(0, 0, w, h); // 항상 전체 클리어
    // 모든 엣지 그리기
    // 모든 노드 그리기
    // 라벨/정보 텍스트 그리기
}
```

## 파일 구조

```
backprop_visualization/
├── index.html              # Alpine.js 템플릿
├── src/
│   ├── styles.css          # 모든 스타일 (BEM)
│   ├── SeededRandom.js     # 난수 생성기 (class, export default)
│   ├── NeuralNetwork.js    # 신경망 로직 (class, export default)
│   ├── Visualizer.js       # Canvas 2D 드로잉 (class, export default)
│   ├── ui.js               # appStore() — Alpine 상태 정의
│   └── app.js              # 진입점: import + Alpine.data('app', appStore)
├── DEV-RULE.md
└── README.md
```

## 동작 흐름

1. `index.html` 로드 → Alpine.js CDN 로드 → `src/app.js`(module) 실행
2. `app.js`가 `Alpine.data('app', appStore)`로 컴포넌트 등록
3. Alpine이 `<body x-data="app">`를 처리, 모든 디렉티브 바인딩
4. 사용자 조작 → Alpine 메서드 호출 → 상태 변경 → 자동 DOM 갱신
5. Canvas는 Visualizer가 직접 그리며, Alpine 상태를 인자로 전달받음

## 신경망 학습 흐름

### 순전파 (forward)
```
입력 → (가중합 z → 시그모이드) → 은닉 → (가중합 z → 시그모이드/Linear) → 출력
```

### 역전파 (backward)
```
출력 오차 계산 → 출력층 δ → 가중치 타고 전파 → 은닉층 δ → ...
각 가중치의 오차영향(gradient) = δ × 이전층출력
```

### 가중치 업데이트 (update)
```
변화량 = -학습률 × gradient
새 가중치 = 기존 가중치 + 변화량
```

### 오해 방지
- **역전파(오차 전달)**: 가중치 w는 '통로' — a가 출력에 기여한 만큼(w) 오차를 전달
- **가중치 업데이트**: w는 '수정 대상' — w 자신의 값이 아닌, w로 들어온 입력(a)이 변화량 결정
