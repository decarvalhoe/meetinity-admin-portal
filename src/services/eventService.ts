import axios from 'axios'

export type EventStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'archived'

export interface EventCategory {
  id: string
  name: string
  description?: string
  color?: string
  createdAt?: string
  updatedAt?: string
}

export interface Event {
  id: string
  title: string
  description?: string
  status: EventStatus
  categoryId?: string
  category?: EventCategory
  startDate: string
  endDate?: string
  organizer?: string
  location?: string
  tags: string[]
  createdAt?: string
  updatedAt?: string
}

export interface EventListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  categoryId?: string
  startDate?: string
  endDate?: string
}

export interface EventInput {
  title: string
  description?: string
  status?: EventStatus
  categoryId?: string
  startDate: string
  endDate?: string
  organizer?: string
  location?: string
  tags?: string[]
}

export interface EventCategoryInput {
  name: string
  description?: string
  color?: string
}

const API = import.meta.env.VITE_API_BASE_URL

export const EventService = {
  async list(params: EventListParams) {
    const { data } = await axios.get(`${API}/api/events`, { params })
    return data as { events: Event[]; total: number }
  },
  async get(id: string) {
    const { data } = await axios.get(`${API}/api/events/${id}`)
    return data as Event
  },
  async create(payload: EventInput) {
    const { data } = await axios.post(`${API}/api/events`, payload)
    return data as Event
  },
  async update(id: string, payload: EventInput) {
    const { data } = await axios.put(`${API}/api/events/${id}`, payload)
    return data as Event
  },
  async remove(id: string) {
    await axios.delete(`${API}/api/events/${id}`)
  },
  async approve(id: string, notes?: string) {
    await axios.post(`${API}/api/events/${id}/approve`, { notes })
  },
  async reject(id: string, reason?: string) {
    await axios.post(`${API}/api/events/${id}/reject`, { reason })
  },
  async archive(id: string) {
    await axios.post(`${API}/api/events/${id}/archive`)
  },
  async bulk(ids: string[], action: 'approve' | 'reject' | 'archive') {
    await axios.post(`${API}/api/events/bulk`, { ids, action })
  },
  async bulkTags(ids: string[], tags: string[]) {
    await axios.post(`${API}/api/events/bulk-tags`, { ids, tags })
  },
  async updateTags(id: string, tags: string[]) {
    await axios.put(`${API}/api/events/${id}/tags`, { tags })
  },
  async listTags() {
    const { data } = await axios.get(`${API}/api/events/tags`)
    return data as string[]
  },
  async listCategories() {
    const { data } = await axios.get(`${API}/api/events/categories`)
    return data as EventCategory[]
  },
  async createCategory(payload: EventCategoryInput) {
    const { data } = await axios.post(`${API}/api/events/categories`, payload)
    return data as EventCategory
  },
  async updateCategory(id: string, payload: EventCategoryInput) {
    const { data } = await axios.put(`${API}/api/events/categories/${id}`, payload)
    return data as EventCategory
  },
  async deleteCategory(id: string) {
    await axios.delete(`${API}/api/events/categories/${id}`)
  }
}
